import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getBotStatus } from "./autobot";
import { buildStrategyCandidates, snapshotAtmIv, STRATEGY_CATALOG } from "./options-strategy-engine.mjs";

const snapshotsDirectory=path.join(process.cwd(),"work","option-snapshots");
const eventsPath=path.join(process.cwd(),"work","autobot","events.json");
type Snapshot={capturedAt:number;capturedAtIso:string;currencies:Array<{currency:string;indexPrice:number;contracts:unknown[]}>};
type Event={eventId:string;title:string;source:string;startsAt:string;expiresAt:string;currencies:("BTC"|"ETH")[];impact:"high"};

async function readSnapshots(limit=2_000){
  try{
    const files=(await fs.readdir(snapshotsDirectory)).filter(name=>name.endsWith(".jsonl")).sort().reverse();
    const snapshots:Snapshot[]=[];
    for(const file of files){
      const lines=(await fs.readFile(path.join(snapshotsDirectory,file),"utf8")).trim().split(/\r?\n/).filter(Boolean).reverse();
      for(const line of lines){try{snapshots.push(JSON.parse(line) as Snapshot);}catch{}if(snapshots.length>=limit)return snapshots.reverse();}
    }
    return snapshots.reverse();
  }catch{return[];}
}
export async function getStrategyEvents(){try{const events=JSON.parse(await fs.readFile(eventsPath,"utf8")) as Event[];return events.filter(event=>Date.parse(event.expiresAt)>Date.now()).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));}catch{return[];}}
export async function saveStrategyEvent(event:Event){const current=await getStrategyEvents(),next=[...current.filter(item=>item.eventId!==event.eventId),event].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,50);await fs.mkdir(path.dirname(eventsPath),{recursive:true});const temporary=`${eventsPath}.${process.pid}.tmp`;await fs.writeFile(temporary,JSON.stringify(next,null,2));await fs.rename(temporary,eventsPath);return next;}

export async function getOptionsStrategyStatus(){
  const [bot,events]=await Promise.all([getBotStatus(),getStrategyEvents()]),snapshots=await readSnapshots(Math.min(Number((bot.config as {minimumIvObservations?:number}).minimumIvObservations??288)+1,2_000));
  const state=bot.state as {decisions?:Record<string,unknown>[];positionCount?:number;openOrderCount?:number};
  const latest=snapshots.at(-1),ageMs=latest?Date.now()-latest.capturedAt:Infinity,fresh=ageMs<=10*60_000;
  const currencies=(bot.config.currencies as ("BTC"|"ETH")[]).map(currency=>{
    const currencySnapshots=snapshots.map(snapshot=>snapshot.currencies.find(item=>item.currency===currency)).filter(Boolean),current=fresh?latest?.currencies.find(item=>item.currency===currency):undefined,ivHistory=currencySnapshots.slice(0,-1).map(snapshot=>snapshotAtmIv(snapshot)).filter((value):value is number=>value!==null),decision=state.decisions?.find(item=>item.currency===currency)??{};
    return{currency,snapshotAgeMs:Number.isFinite(ageMs)?ageMs:null,candidates:buildStrategyCandidates({currency,snapshot:current,ivHistory,decision,events,config:bot.config})};
  });
  return{environment:"DERIBIT_TESTNET",generatedAt:new Date().toISOString(),catalog:STRATEGY_CATALOG,currencies,events,portfolio:{positions:state.positionCount??0,openOrders:state.openOrderCount??0},safety:{productionRoutingAvailable:false,atomicDefinedRiskOnly:true,nakedShortVolRoutingAvailable:false,coveredCallRoutingAvailable:false,eventWebhookConfigured:Boolean(process.env.CRYPTOV2_EVENT_WEBHOOK_SECRET)}};
}
