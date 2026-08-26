import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),worker=path.join(root,"bot","option-snapshot-recorder.mjs");let child,stopping=false,restarts=0;
function start(){child=spawn(process.execPath,[worker],{cwd:root,env:process.env,stdio:"inherit",windowsHide:true});console.log(`[OPTION_SNAPSHOT_SUPERVISOR] Recorder started pid=${child.pid}`);child.once("exit",(code,signal)=>{if(stopping)return;restarts+=1;const delay=Math.min(30_000,1000*2**Math.min(restarts,5));console.error(`[OPTION_SNAPSHOT_SUPERVISOR] Recorder exited code=${code} signal=${signal}; restarting in ${delay}ms`);setTimeout(start,delay);});}
function shutdown(signal){stopping=true;if(child&&!child.killed)child.kill(signal);setTimeout(()=>process.exit(0),500).unref();}process.on("SIGINT",()=>shutdown("SIGINT"));process.on("SIGTERM",()=>shutdown("SIGTERM"));start();
