import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRestart, writeRestart } from "./hot-restart-protocol.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const runtime=path.join(root,"work","autobot"),restartPath=path.join(runtime,"hot-restart.json"),statePath=path.join(runtime,"state.json");
const restartId=process.argv[2];
function loadEnv(){const file=path.join(root,".env.local");if(!fs.existsSync(file))return;for(const line of fs.readFileSync(file,"utf8").split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].trim();}}
async function rpc(method,params={},token=null){const url=new URL(`https://test.deribit.com/api/v2/${method}`);for(const[key,value]of Object.entries(params))url.searchParams.set(key,String(value));const response=await fetch(url,{signal:AbortSignal.timeout(15_000),headers:token?{Authorization:`Bearer ${token}`}:{}}),body=await response.json();if(!response.ok||body.error)throw new Error(body.error?.message??`HTTP_${response.status}`);return body.result;}
function finish(ready,error=null,details={}){const request=readRestart(restartPath);if(request?.restartId===restartId)writeRestart(restartPath,{...request,preflight:{ready,error,checkedAt:new Date().toISOString(),...details}});process.exit(ready?0:1);}
try{
  loadEnv();
  if(!restartId)throw new Error("RESTART_ID_REQUIRED");
  const request=readRestart(restartPath),state=JSON.parse(fs.readFileSync(statePath,"utf8"));
  if(request?.restartId!==restartId)throw new Error("RESTART_REQUEST_MISMATCH");
  if(state.evaluationInFlight||state.pendingOrders?.length||Number(state.openOrderCount)!==0||state.reconciliationRequired||state.error)throw new Error("WORKER_NOT_DRAINED");
  const auth=await rpc("public/auth",{grant_type:"client_credentials",client_id:process.env.DERIBIT_TESTNET_CLIENT_ID,client_secret:process.env.DERIBIT_TESTNET_CLIENT_SECRET}),token=auth.access_token;
  const results=await Promise.all(["BTC","ETH"].map(async currency=>({currency,positions:await rpc("private/get_positions",{currency,kind:"option"},token),orders:await rpc("private/get_open_orders_by_currency",{currency,kind:"option"},token)})));
  const active=results.flatMap(item=>item.positions).filter(item=>Math.abs(Number(item.size??0))>0).map(item=>item.instrument_name),botOrders=results.flatMap(item=>item.orders).filter(item=>String(item.label).startsWith("CV2-AI-")),managed=new Set(state.managedInstruments??[]),unowned=active.filter(name=>!managed.has(name));
  if(botOrders.length)throw new Error("BOT_RESTING_ORDERS_PRESENT");
  if(unowned.length)throw new Error(`UNOWNED_POSITIONS:${unowned.join(",")}`);
  finish(true,null,{activePositions:active,managedPositions:[...managed],openOrderCount:0});
}catch(error){finish(false,error instanceof Error?error.message:String(error));}
