import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSignal, executionPolicy, riskDecision } from "./engine.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = path.join(ROOT, "work", "autobot");
const CONFIG_PATH = path.join(RUNTIME, "config.json");
const STATE_PATH = path.join(RUNTIME, "state.json");
const JOURNAL_PATH = path.join(RUNTIME, "journal.jsonl");
const TESTNET = "https://test.deribit.com/api/v2";
const DEFAULT_CONFIG = { enabled:false, currencies:["BTC","ETH"], minimumScore:75, maxPremiumUsd:50, maxDailyTrades:2, cooldownMinutes:120, stopLossPct:30, takeProfitPct:50 };
fs.mkdirSync(RUNTIME, { recursive:true });

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file,"utf8")); } catch { return fallback; } }
function atomicWrite(file, value) { const temp=`${file}.${process.pid}.tmp`; fs.writeFileSync(temp,JSON.stringify(value,null,2)); fs.renameSync(temp,file); }
function journal(event) { fs.appendFileSync(JOURNAL_PATH, `${JSON.stringify({ timestamp:new Date().toISOString(), ...event })}\n`); }
function config() { return { ...DEFAULT_CONFIG, ...readJson(CONFIG_PATH, DEFAULT_CONFIG) }; }
let state = readJson(STATE_PATH, { startedAt:new Date().toISOString(), tradesToday:[], managedInstruments:[] });
let token = null;

async function rpc(method, params={}, accessToken=null) {
  const url=new URL(`${TESTNET}/${method}`); for(const [key,value] of Object.entries(params))url.searchParams.set(key,typeof value==="object"?JSON.stringify(value):String(value));
  const response=await fetch(url,{signal:AbortSignal.timeout(10_000),headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}}); const body=await response.json();
  if(!response.ok||body.error)throw new Error(`${body.error?.message??`HTTP_${response.status}`}`); return body.result;
}
async function auth() {
  if(token&&token.expiresAt>Date.now()+30_000)return token.value;
  const result=await rpc("public/auth",{grant_type:"client_credentials",client_id:process.env.DERIBIT_TESTNET_CLIENT_ID,client_secret:process.env.DERIBIT_TESTNET_CLIENT_SECRET});
  token={value:result.access_token,expiresAt:Date.now()+result.expires_in*1000}; return token.value;
}
async function privateRpc(method,params){return rpc(method,params,await auth());}
async function candles(currency){const end=Date.now(),start=end-15*60_000*220;return rpc("public/get_tradingview_chart_data",{instrument_name:`${currency}-PERPETUAL`,start_timestamp:start,end_timestamp:end,resolution:"15"});}
async function account(currency){const access=await auth();const [positions,orders]=await Promise.all([rpc("private/get_positions",{currency,kind:"option"},access),rpc("private/get_open_orders_by_currency",{currency,kind:"option"},access)]);return{positions,orders};}
async function chooseOption(currency,action,spot,maximumPremium){
  const [instruments,summaries]=await Promise.all([rpc("public/get_instruments",{currency,kind:"option",expired:false}),rpc("public/get_book_summary_by_currency",{currency,kind:"option"})]);
  const now=Date.now(),minExpiry=now+7*864e5,maxExpiry=now+21*864e5,type=action==="BUY_CALL"?"call":"put",summary=new Map(summaries.map(item=>[item.instrument_name,item]));
  const candidates=instruments.filter(item=>item.option_type===type&&item.expiration_timestamp>=minExpiry&&item.expiration_timestamp<=maxExpiry).map(item=>({...item,book:summary.get(item.instrument_name)})).filter(item=>item.book?.ask_price>0).sort((a,b)=>a.expiration_timestamp-b.expiration_timestamp||Math.abs(a.strike-spot)-Math.abs(b.strike-spot));
  const selected=candidates.find(item=>item.book.ask_price*spot*item.min_trade_amount<=maximumPremium); if(!selected)return null;
  const precision=(String(selected.tick_size).split(".")[1]??"").length,price=Number((Math.round(selected.book.ask_price/selected.tick_size)*selected.tick_size).toFixed(precision));
  return{instrumentName:selected.instrument_name,amount:selected.min_trade_amount,price,premiumUsd:price*spot*selected.min_trade_amount};
}
async function cancelBotOrders(orders,currency){for(const order of orders.filter(item=>String(item.label).startsWith("CV2-AI-"))){await privateRpc("private/cancel",{order_id:order.order_id});journal({type:"ORDER_CANCELLED_ON_HALT",currency,orderId:order.order_id});}}
async function closeManagedPosition(position,currency,reason){
  const ticker=await rpc("public/ticker",{instrument_name:position.instrument_name}); const bid=ticker.best_bid_price;
  if(!(bid>0))return false; const instrument=await rpc("public/get_instrument",{instrument_name:position.instrument_name}); const precision=(String(instrument.tick_size).split(".")[1]??"").length,price=Number((Math.floor(bid/instrument.tick_size)*instrument.tick_size).toFixed(precision));
  const label=`CV2-AI-EXIT-${currency}-${Date.now()}`.slice(0,64); const result=await privateRpc("private/sell",{instrument_name:position.instrument_name,amount:Math.abs(position.size),type:"limit",price,time_in_force:"immediate_or_cancel",reduce_only:true,label});
  journal({type:"AUTONOMOUS_EXIT",currency,instrumentName:position.instrument_name,reason,price,orderId:result.order?.order_id,orderState:result.order?.order_state,label}); return (result.trades??[]).length>0;
}

async function evaluate() {
  loadEnv(); const cfg=config(),executionGate=process.env.DERIBIT_AUTOBOT_TESTNET_ROUTING==="true",credentials=Boolean(process.env.DERIBIT_TESTNET_CLIENT_ID&&process.env.DERIBIT_TESTNET_CLIENT_SECRET);
  const today=new Date().toISOString().slice(0,10); state.tradesToday=(state.tradesToday??[]).filter(item=>String(item.timestamp).startsWith(today));
  const policy=executionPolicy({executionGate,credentials,entryEnabled:cfg.enabled});
  const decisions=[]; let positionCount=0,orderCount=0;
  for(const currency of cfg.currencies){
    const chart=await candles(currency),signal=evaluateSignal(chart,cfg.minimumScore); let snapshot={positions:[],orders:[]};
    if(credentials)snapshot=await account(currency); const botOrders=snapshot.orders.filter(item=>String(item.label).startsWith("CV2-AI-")); const managed=snapshot.positions.filter(item=>(state.managedInstruments??[]).includes(item.instrument_name));
    positionCount+=managed.length;orderCount+=botOrders.length;
    if((!cfg.enabled||!executionGate)&&botOrders.length&&credentials)await cancelBotOrders(botOrders,currency);
    if(policy.manageExits){for(const position of managed){const pnlPct=position.average_price?((position.mark_price-position.average_price)/position.average_price)*100:0;const optionType=String(position.instrument_name).endsWith("-C")?"call":"put";const opposite=(optionType==="call"&&signal.action==="BUY_PUT")||(optionType==="put"&&signal.action==="BUY_CALL");const reason=pnlPct<=-cfg.stopLossPct?"STOP_LOSS":pnlPct>=cfg.takeProfitPct?"TAKE_PROFIT":opposite?"OPPOSITE_SIGNAL":null;if(reason&&await closeManagedPosition(position,currency,reason))state.managedInstruments=state.managedInstruments.filter(name=>name!==position.instrument_name);}}
    const risk=riskDecision({signal,config:cfg,positions:managed.length,openOrders:botOrders.length,dailyTrades:state.tradesToday.length,lastTradeAt:state.lastTradeAt??0});
    const decision={currency,...signal,risk:risk.reason,executionEligible:Boolean(policy.allowEntries&&risk.allowed)}; decisions.push(decision);
    if(decision.executionEligible){
      if(!config().enabled){decision.executionEligible=false;decision.risk="HALT_DETECTED_BEFORE_ORDER";continue;}
      const option=await chooseOption(currency,signal.action,signal.price,cfg.maxPremiumUsd);
      if(!option){decision.risk="NO_OPTION_WITHIN_PREMIUM_CAP";continue;}
      const label=`CV2-AI-${currency}-${Date.now()}`.slice(0,64);
      const result=await privateRpc("private/buy",{instrument_name:option.instrumentName,amount:option.amount,type:"limit",price:option.price,time_in_force:"immediate_or_cancel",label});
      const order=result.order??{}; journal({type:"AUTONOMOUS_ENTRY",currency,signal,option,orderId:order.order_id,orderState:order.order_state,label});
      state.lastTradeAt=Date.now();state.tradesToday.push({timestamp:new Date().toISOString(),currency,instrumentName:option.instrumentName,orderId:order.order_id});
      if((result.trades??[]).length)state.managedInstruments=[...new Set([...(state.managedInstruments??[]),option.instrumentName])];
    }
  }
  state={...state,environment:"DERIBIT_TESTNET",workerOnline:true,executionGate,configured:credentials,enabled:policy.allowEntries,exitManagementActive:policy.manageExits,lastHeartbeat:new Date().toISOString(),lastEvaluation:new Date().toISOString(),nextEvaluation:new Date(Date.now()+60_000).toISOString(),decisions,positionCount,openOrderCount:orderCount,error:null,pid:process.pid};atomicWrite(STATE_PATH,state);
}
async function cycle(){try{await evaluate();}catch(error){state={...state,environment:"DERIBIT_TESTNET",workerOnline:true,enabled:false,lastHeartbeat:new Date().toISOString(),error:error instanceof Error?error.message:String(error),pid:process.pid};atomicWrite(STATE_PATH,state);journal({type:"ENGINE_ERROR",message:state.error});}}
if(!fs.existsSync(CONFIG_PATH))atomicWrite(CONFIG_PATH,DEFAULT_CONFIG);
loadEnv();journal({type:"WORKER_STARTED",pid:process.pid,executionGate:process.env.DERIBIT_AUTOBOT_TESTNET_ROUTING==="true"});
await cycle();setInterval(()=>void cycle(),60_000);setInterval(()=>{state.lastHeartbeat=new Date().toISOString();state.workerOnline=true;atomicWrite(STATE_PATH,state);},10_000);
