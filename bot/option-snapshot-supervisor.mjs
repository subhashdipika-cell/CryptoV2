import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRestart, RESTART_PHASES, writeRestart } from "./hot-restart-protocol.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const worker=path.join(root,"bot","option-snapshot-recorder.mjs"),runtime=path.join(root,"work","option-snapshots"),statusPath=path.join(runtime,"status.json"),restartPath=path.join(runtime,"hot-restart.json");
let child,stopping=false,restarts=0,plannedRestart=null,deadline=0;
function start(restartId=null){
  child=spawn(process.execPath,[worker],{cwd:root,env:process.env,stdio:"inherit",windowsHide:true});
  console.log(`[OPTION_SNAPSHOT_SUPERVISOR] Recorder started pid=${child.pid}`);
  if(restartId){const request=readRestart(restartPath);if(request?.restartId===restartId)writeRestart(restartPath,{...request,phase:RESTART_PHASES.STARTING,replacementPid:child.pid,startedAt:new Date().toISOString()});deadline=Date.now()+120_000;}
  child.once("exit",(code,signal)=>{
    child=null;if(stopping)return;
    if(plannedRestart){const restartId=plannedRestart;plannedRestart=null;setTimeout(()=>start(restartId),300);return;}
    restarts+=1;const delay=Math.min(30_000,1000*2**Math.min(restarts,5));console.error(`[OPTION_SNAPSHOT_SUPERVISOR] Recorder exited code=${code} signal=${signal}; restarting in ${delay}ms`);setTimeout(()=>start(),delay);
  });
  child.once("spawn",()=>{restarts=0;});
}
function readStatus(){try{return JSON.parse(fs.readFileSync(statusPath,"utf8"));}catch{return{};}}
function control(){
  const request=readRestart(restartPath);if(!request||!child)return;
  if(request.phase===RESTART_PHASES.REQUESTED){plannedRestart=request.restartId;writeRestart(restartPath,{...request,phase:"STOPPING",oldRecorderPid:child.pid,stoppingAt:new Date().toISOString()});child.kill("SIGTERM");return;}
  if(request.phase===RESTART_PHASES.STARTING&&Number(request.replacementPid)===Number(child.pid)){
    const status=readStatus(),fresh=Date.now()-Date.parse(status.lastHeartbeat??0)<30_000;
    if(status.recorderOnline===true&&Number(status.pid)===Number(child.pid)&&fresh&&!status.error){writeRestart(restartPath,{...request,phase:RESTART_PHASES.ACTIVE,activeRecorderPid:child.pid,completedAt:new Date().toISOString(),error:null,latest:status.latest??null});deadline=0;return;}
    if(deadline&&Date.now()>deadline){writeRestart(restartPath,{...request,phase:RESTART_PHASES.FAILED,error:"RECORDER_READINESS_TIMEOUT",failedAt:new Date().toISOString()});deadline=0;}
  }
}
function shutdown(signal){stopping=true;clearInterval(timer);if(child&&!child.killed)child.kill(signal);setTimeout(()=>process.exit(0),1_500).unref();}
fs.mkdirSync(runtime,{recursive:true});process.on("SIGINT",()=>shutdown("SIGINT"));process.on("SIGTERM",()=>shutdown("SIGTERM"));start();const timer=setInterval(control,500);
