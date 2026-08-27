import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRestartRequest, readRestart, RESTART_PHASES, writeRestart } from "./hot-restart-protocol.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const botRuntime=path.join(root,"work","autobot"),botRestart=path.join(botRuntime,"hot-restart.json"),statePath=path.join(botRuntime,"state.json"),snapshotRuntime=path.join(root,"work","option-snapshots"),snapshotRestart=path.join(snapshotRuntime,"hot-restart.json");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8"));}
async function waitFor(file,restartId,timeoutMs){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){const value=readRestart(file);if(value?.restartId===restartId&&value.phase===RESTART_PHASES.ACTIVE)return value;if(value?.restartId===restartId&&[RESTART_PHASES.FAILED,RESTART_PHASES.ROLLED_BACK].includes(value.phase))throw new Error(`${value.phase}:${value.error??"UNKNOWN"}`);await wait(500);}throw new Error("HOT_RESTART_TIMEOUT");}

const state=readJson(statePath),heartbeat=Date.parse(state.lastHeartbeat??0);
if(state.environment!=="DERIBIT_TESTNET")throw new Error("HOT_RESTART_TESTNET_ONLY");
if(Date.now()-heartbeat>=30_000||state.workerOnline!==true)throw new Error("WORKER_NOT_HEALTHY");
if(state.exitManagementActive!==true||state.degraded||state.reconciliationRequired||state.error)throw new Error("WORKER_SAFETY_GATE_FAILED");
if(state.evaluationInFlight||state.pendingOrders?.length||Number(state.openOrderCount)!==0)throw new Error("WORKER_NOT_READY_TO_DRAIN");
const existing=readRestart(botRestart);
if(existing&&![RESTART_PHASES.ACTIVE,RESTART_PHASES.FAILED,RESTART_PHASES.ROLLED_BACK].includes(existing.phase))throw new Error(`HOT_RESTART_ALREADY_${existing.phase}`);
const request=createRestartRequest();
writeRestart(botRestart,{...request,requestedWorkerPid:state.pid,managedInstruments:[...(state.managedInstruments??[])]});
console.log(`[HOT_RESTART] Requested ${request.restartId}; new entries are draining.`);
const botResult=await waitFor(botRestart,request.restartId,240_000);
console.log(`[HOT_RESTART] Worker verified pid=${botResult.activeWorkerPid}.`);
fs.mkdirSync(snapshotRuntime,{recursive:true});
const snapshotRequest=createRestartRequest("WORKER_HOT_RESTART_FOLLOWUP");
writeRestart(snapshotRestart,snapshotRequest);
const snapshotResult=await waitFor(snapshotRestart,snapshotRequest.restartId,180_000);
console.log(`[HOT_RESTART] Snapshot recorder verified pid=${snapshotResult.activeRecorderPid}.`);
console.log(JSON.stringify({worker:botResult,snapshotRecorder:snapshotResult},null,2));
