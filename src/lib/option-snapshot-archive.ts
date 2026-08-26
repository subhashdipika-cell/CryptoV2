import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

type SnapshotStatus={
  environment?:string;
  publicOnly?:boolean;
  credentialsUsed?:boolean;
  routingAvailable?:boolean;
  recorderOnline?:boolean;
  pid?:number;
  startedAt?:string;
  lastHeartbeat?:string;
  lastSnapshot?:string|null;
  nextSnapshot?:string|null;
  snapshotCount?:number;
  error?:string|null;
  consecutiveErrors?:number;
  totalErrors?:number;
  latest?:unknown;
};

const archiveDirectory=path.join(process.cwd(),"work","option-snapshots");
const statusPath=path.join(archiveDirectory,"status.json");

export async function getOptionSnapshotArchive(){
  let status:SnapshotStatus={recorderOnline:false};
  try{status=JSON.parse(await fs.readFile(statusPath,"utf8")) as SnapshotStatus;}catch{}
  let files:{name:string;bytes:number}[]=[];
  try{
    const names=(await fs.readdir(archiveDirectory)).filter(name=>/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)).sort();
    files=await Promise.all(names.map(async name=>({name,bytes:(await fs.stat(path.join(archiveDirectory,name))).size})));
  }catch{}
  const heartbeatMs=status.lastHeartbeat?Date.parse(status.lastHeartbeat):0;
  const recorderOnline=Boolean(status.recorderOnline&&heartbeatMs&&Date.now()-heartbeatMs<45_000);
  return{
    environment:"DERIBIT_TESTNET",
    recorderOnline,
    status:{...status,recorderOnline},
    archive:{files:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0),firstDate:files[0]?.name.slice(0,10)??null,lastDate:files.at(-1)?.name.slice(0,10)??null},
    safety:{publicOnly:true,credentialsUsed:false,routingAvailable:false},
  };
}
