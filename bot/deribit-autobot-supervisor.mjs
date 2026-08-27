import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRestart, RESTART_PHASES, writeRestart } from "./hot-restart-protocol.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtime = path.join(root, "work", "autobot");
const worker = path.join(root, "bot", "deribit-autobot-v2.mjs");
const preflight = path.join(root, "bot", "autobot-hot-restart-preflight.mjs");
const restartPath = path.join(runtime, "hot-restart.json");
const statePath = path.join(runtime, "state.json");
let child;
let stopping = false;
let restartCount = 0;
let plannedRestart = null;
let preflightChild = null;
let replacementDeadline = 0;

function readState() { try { return JSON.parse(fs.readFileSync(statePath,"utf8")); } catch { return {}; } }

function start(restartId = null) {
  child = spawn(process.execPath, [worker], { cwd:root, env:{...process.env,CRYPTOV2_HOT_RESTART_ID:restartId??""}, stdio:"inherit", windowsHide:true });
  console.log(`[AUTOBOT_SUPERVISOR] Worker started pid=${child.pid}${restartId?` restart=${restartId}`:""}`);
  if (restartId) {
    const request=readRestart(restartPath);
    if(request?.restartId===restartId)writeRestart(restartPath,{...request,phase:RESTART_PHASES.STARTING,replacementPid:child.pid,startedAt:new Date().toISOString()});
    replacementDeadline=Date.now()+90_000;
  }
  child.once("exit", (code, signal) => {
    const exitedPid=child?.pid;
    child=null;
    if (stopping) return;
    if (plannedRestart?.restartId) {
      const restartId=plannedRestart.restartId;
      plannedRestart=null;
      setTimeout(()=>start(restartId),500);
      return;
    }
    restartCount += 1;
    const delay = Math.min(30_000, 2_000 * restartCount);
    console.error(`[AUTOBOT_SUPERVISOR] Worker exited pid=${exitedPid} code=${code} signal=${signal}; restarting in ${delay}ms`);
    setTimeout(()=>start(),delay);
  });
  child.once("spawn", () => { restartCount=0; });
}

function rollback(request,message){
  writeRestart(restartPath,{...request,phase:RESTART_PHASES.ROLLED_BACK,error:message,rolledBackAt:new Date().toISOString(),activeWorkerPid:child?.pid??null});
  console.error(`[AUTOBOT_SUPERVISOR] Hot restart rolled back: ${message}`);
}

function beginPreflight(request){
  if(preflightChild)return;
  const state=readState();
  if(Number(state.pid)!==Number(child?.pid)){rollback(request,"STATE_WORKER_PID_MISMATCH");return;}
  writeRestart(restartPath,{...request,phase:RESTART_PHASES.PREFLIGHT,preflightStartedAt:new Date().toISOString()});
  preflightChild=spawn(process.execPath,[preflight,request.restartId],{cwd:root,env:process.env,stdio:"inherit",windowsHide:true});
  preflightChild.once("exit",code=>{
    preflightChild=null;
    const current=readRestart(restartPath);
    if(!current||current.restartId!==request.restartId)return;
    if(code!==0||current.preflight?.ready!==true){rollback(current,current.preflight?.error??`PREFLIGHT_EXIT_${code}`);return;}
    if(Number(current.drainedWorkerPid)!==Number(child?.pid)){rollback(current,"DRAINED_WORKER_PID_CHANGED");return;}
    plannedRestart={restartId:request.restartId,oldPid:child.pid};
    writeRestart(restartPath,{...current,phase:"STOPPING",oldWorkerPid:child.pid,stoppingAt:new Date().toISOString()});
    child.kill("SIGTERM");
  });
}

function superviseRestart(){
  const request=readRestart(restartPath);
  if(!request||!child)return;
  if(request.phase===RESTART_PHASES.DRAINED&&Number(request.drainedWorkerPid)===Number(child.pid)){beginPreflight(request);return;}
  if(request.phase===RESTART_PHASES.READY&&Number(request.verifiedWorkerPid)===Number(child.pid)){
    writeRestart(restartPath,{...request,phase:RESTART_PHASES.ACTIVE,activeWorkerPid:child.pid,completedAt:new Date().toISOString(),error:null});
    replacementDeadline=0;
    console.log(`[AUTOBOT_SUPERVISOR] Hot restart complete restart=${request.restartId} pid=${child.pid}`);
    return;
  }
  if(replacementDeadline&&Date.now()>replacementDeadline&&[RESTART_PHASES.STARTING,RESTART_PHASES.READY].includes(request.phase)){
    replacementDeadline=0;
    writeRestart(restartPath,{...request,phase:RESTART_PHASES.FAILED,error:"REPLACEMENT_READINESS_TIMEOUT",failedAt:new Date().toISOString()});
    console.error("[AUTOBOT_SUPERVISOR] Replacement readiness timed out; worker remains fail-closed for new entries.");
  }
}

function shutdown(signal) {
  stopping=true;
  clearInterval(controlTimer);
  if(preflightChild&&!preflightChild.killed)preflightChild.kill(signal);
  if(child&&!child.killed)child.kill(signal);
  setTimeout(()=>process.exit(0),2_000).unref();
}

fs.mkdirSync(runtime,{recursive:true});
process.on("SIGINT",()=>shutdown("SIGINT"));
process.on("SIGTERM",()=>shutdown("SIGTERM"));
start();
const controlTimer=setInterval(superviseRestart,500);
