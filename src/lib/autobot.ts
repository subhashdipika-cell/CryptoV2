import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DEFAULT_OPTIONS_STRATEGY_CONFIG, STRATEGY_IDS } from "./options-strategy-engine.mjs";

const runtime = path.join(process.cwd(), "work", "autobot");
const configPath = path.join(runtime, "config.json");
const statePath = path.join(runtime, "state.json");
const journalPath = path.join(runtime, "journal.jsonl");
export const defaultBotConfig = { enabled:false, currencies:["BTC","ETH"], minimumScore:75, maxPremiumUsd:50, maxDailyTrades:4, cooldownMinutes:120, stopLossPct:30, takeProfitPct:50, ...DEFAULT_OPTIONS_STRATEGY_CONFIG };
export const botConfigSchema = z.object({
  enabled:z.boolean(), currencies:z.array(z.enum(["BTC","ETH"])).min(1).max(2), minimumScore:z.number().int().min(65).max(95),
  maxPremiumUsd:z.number().min(5).max(500), maxDailyTrades:z.number().int().min(1).max(5), cooldownMinutes:z.number().int().min(15).max(1440),
  stopLossPct:z.number().int().min(10).max(80), takeProfitPct:z.number().int().min(10).max(300),
  enabledStrategies:z.array(z.enum(STRATEGY_IDS as [string,...string[]])).min(1).max(6), minimumIvObservations:z.number().int().min(12).max(1_999),
  minimumOpenInterest:z.number().min(0).max(100_000), maximumSpreadPct:z.number().min(1).max(100), maxDefinedRiskUsd:z.number().min(10).max(5_000), maxMarginUtilizationPct:z.number().min(5).max(80),
  ironCondorIvPercentile:z.number().min(50).max(99), shortVolIvPercentile:z.number().min(50).max(99), deltaHedgeThreshold:z.number().min(.05).max(1),
  eventWindowMinutes:z.number().int().min(15).max(1440), maxStrategyHours:z.number().int().min(1).max(168), confirmation:z.string().optional(),
}).strict();

async function readJson(file:string,fallback:unknown){try{return JSON.parse(await fs.readFile(file,"utf8"));}catch{return fallback;}}
export async function getBotConfig(){return{...defaultBotConfig,...await readJson(configPath,defaultBotConfig)};}
export async function getBotStatus(){
  const [config,state,journalText]=await Promise.all([getBotConfig(),readJson(statePath,{}),fs.readFile(journalPath,"utf8").catch(()=>"")]);
  const journal=journalText.trim().split(/\r?\n/).filter(Boolean).slice(-50).reverse().map(line=>{try{return JSON.parse(line);}catch{return{type:"INVALID_JOURNAL_LINE"};}});
  const heartbeat=typeof (state as {lastHeartbeat?:unknown}).lastHeartbeat==="string"?Date.parse((state as {lastHeartbeat:string}).lastHeartbeat):0;
  return{environment:"DERIBIT_TESTNET",config,state:{...(state as object),workerOnline:Date.now()-heartbeat<30_000},journal,safety:{productionRoutingAvailable:false,executionEnvironmentLocked:true,serverExecutionGate:process.env.DERIBIT_AUTOBOT_TESTNET_ROUTING==="true"}};
}
export async function saveBotConfig(value:unknown){
  const parsed=botConfigSchema.parse(value); if(parsed.enabled&&(process.env.DERIBIT_AUTOBOT_TESTNET_ROUTING!=="true"||parsed.confirmation!=="ENABLE DERIBIT TESTNET AUTOBOT"))throw new Error("AUTOBOT_TESTNET_ACTIVATION_REQUIRED");
  const {confirmation:_,...config}=parsed;void _;await fs.mkdir(runtime,{recursive:true});const temp=`${configPath}.${process.pid}.tmp`;await fs.writeFile(temp,JSON.stringify(config,null,2));await fs.rename(temp,configPath);return config;
}
export async function haltBot(){const current=await getBotConfig();return saveBotConfig({...current,enabled:false});}
