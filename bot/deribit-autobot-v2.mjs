import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dailyTradeCountForCurrency, evaluateSignal, executionPolicy, riskDecision } from "./engine.mjs";
import { errorMessage, filledAmount, findActivePosition, isAmbiguousTransportError } from "./order-state.mjs";
import { atomicWriteJson } from "./state-store.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = path.join(ROOT, "work", "autobot");
const CONFIG_PATH = path.join(RUNTIME, "config.json");
const STATE_PATH = path.join(RUNTIME, "state.json");
const JOURNAL_PATH = path.join(RUNTIME, "journal.jsonl");
const TESTNET = "https://test.deribit.com/api/v2";
const RPC_TIMEOUT_MS = 15_000;
const DEFAULT_CONFIG = { enabled:false, currencies:["BTC","ETH"], minimumScore:75, maxPremiumUsd:50, maxDailyTrades:4, cooldownMinutes:120, stopLossPct:30, takeProfitPct:50 };
fs.mkdirSync(RUNTIME, { recursive:true });

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file,"utf8")); } catch { return fallback; } }
function journal(event) { fs.appendFileSync(JOURNAL_PATH, `${JSON.stringify({ timestamp:new Date().toISOString(), ...event })}\n`); }
function persistState(context) {
  try { atomicWriteJson(STATE_PATH,state); return true; }
  catch(error) { journal({type:"STATE_WRITE_ERROR",context,message:error instanceof Error?error.message:String(error)}); return false; }
}
function config() { return { ...DEFAULT_CONFIG, ...readJson(CONFIG_PATH, DEFAULT_CONFIG) }; }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function isRetryableRead(method) { return method.startsWith("public/") || method.startsWith("private/get_"); }

let state = readJson(STATE_PATH, { startedAt:new Date().toISOString(), tradesToday:[], managedInstruments:[], pendingOrders:[] });
state.pendingOrders ??= [];
state.currencyHealth ??= {};
state.currencyPositionCounts ??= {};
state.currencyOrderCounts ??= {};
state.skippedCycles ??= 0;
state.totalErrorCycles ??= 0;
state.consecutiveErrorCycles ??= 0;
let token = null;
let cycleInFlight = false;

async function rpc(method, params={}, accessToken=null) {
  const attempts=isRetryableRead(method)?3:1;
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const url=new URL(`${TESTNET}/${method}`);
      for(const [key,value] of Object.entries(params))url.searchParams.set(key,typeof value==="object"?JSON.stringify(value):String(value));
      const response=await fetch(url,{signal:AbortSignal.timeout(RPC_TIMEOUT_MS),headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}});
      const body=await response.json();
      if(!response.ok||body.error)throw new Error(`${body.error?.message??`HTTP_${response.status}`}`);
      return body.result;
    }catch(error){
      lastError=error;
      if(attempt>=attempts||!isAmbiguousTransportError(error))throw error;
      journal({type:"RPC_READ_RETRY",method,attempt,message:errorMessage(error)});
      await delay(250*attempt);
    }
  }
  throw lastError;
}

async function auth() {
  if(token&&token.expiresAt>Date.now()+30_000)return token.value;
  const result=await rpc("public/auth",{grant_type:"client_credentials",client_id:process.env.DERIBIT_TESTNET_CLIENT_ID,client_secret:process.env.DERIBIT_TESTNET_CLIENT_SECRET});
  token={value:result.access_token,expiresAt:Date.now()+result.expires_in*1000};
  return token.value;
}
async function privateRpc(method,params){return rpc(method,params,await auth());}
async function candles(currency){const end=Date.now(),start=end-15*60_000*220;return rpc("public/get_tradingview_chart_data",{instrument_name:`${currency}-PERPETUAL`,start_timestamp:start,end_timestamp:end,resolution:"15"});}
async function account(currency){const access=await auth();const [positions,orders]=await Promise.all([rpc("private/get_positions",{currency,kind:"option"},access),rpc("private/get_open_orders_by_currency",{currency,kind:"option"},access)]);return{positions,orders};}

async function chooseOption(currency,action,spot,maximumPremium){
  const [instruments,summaries]=await Promise.all([rpc("public/get_instruments",{currency,kind:"option",expired:false}),rpc("public/get_book_summary_by_currency",{currency,kind:"option"})]);
  const now=Date.now(),minExpiry=now+7*864e5,maxExpiry=now+21*864e5,type=action==="BUY_CALL"?"call":"put",summary=new Map(summaries.map(item=>[item.instrument_name,item]));
  const candidates=instruments.filter(item=>item.option_type===type&&item.expiration_timestamp>=minExpiry&&item.expiration_timestamp<=maxExpiry).map(item=>({...item,book:summary.get(item.instrument_name)})).filter(item=>item.book?.ask_price>0).sort((a,b)=>a.expiration_timestamp-b.expiration_timestamp||Math.abs(a.strike-spot)-Math.abs(b.strike-spot));
  const selected=candidates.find(item=>item.book.ask_price*spot*item.min_trade_amount<=maximumPremium);
  if(!selected)return null;
  const precision=(String(selected.tick_size).split(".")[1]??"").length,price=Number((Math.round(selected.book.ask_price/selected.tick_size)*selected.tick_size).toFixed(precision));
  return{instrumentName:selected.instrument_name,amount:selected.min_trade_amount,price,premiumUsd:price*spot*selected.min_trade_amount};
}

async function orderByLabel(currency,label){
  const access=await auth();
  const [open,history]=await Promise.all([
    rpc("private/get_open_orders_by_currency",{currency,kind:"option"},access),
    rpc("private/get_order_history_by_currency",{currency,kind:"option",count:100,include_unfilled:true},access),
  ]);
  const order=[...open,...history].find(item=>item.label===label);
  if(!order)return null;
  let trades=[];
  if(order.order_id){
    const result=await rpc("private/get_user_trades_by_order",{order_id:order.order_id,sorting:"asc",historical:false},access);
    trades=result?.trades??[];
  }
  return{order,trades};
}

function addPendingOrder(pending){
  state.pendingOrders=[...(state.pendingOrders??[]).filter(item=>item.label!==pending.label),pending];
  persistState("ORDER_INTENTION");
}
function clearPendingOrder(label){state.pendingOrders=(state.pendingOrders??[]).filter(item=>item.label!==label);persistState("ORDER_RESOLVED");}

async function submitPrivateOrder(method,params,{currency,label,instrumentName,side}){
  addPendingOrder({currency,label,instrumentName,side,amount:params.amount,createdAt:new Date().toISOString(),checks:0});
  try{
    const result=await privateRpc(method,params);
    clearPendingOrder(label);
    return{...result,reconciled:false};
  }catch(error){
    if(!isAmbiguousTransportError(error)){clearPendingOrder(label);throw error;}
    journal({type:"ORDER_RESPONSE_AMBIGUOUS",currency,instrumentName,label,message:errorMessage(error)});
    await delay(750);
    const found=await orderByLabel(currency,label).catch(()=>null);
    if(found){clearPendingOrder(label);journal({type:"ORDER_RECONCILED",currency,instrumentName,label,orderId:found.order?.order_id});return{...found,reconciled:true};}
    throw new Error(`ORDER_RECONCILIATION_REQUIRED:${label}`);
  }
}

async function reconcilePendingOrders(){
  const unresolved=[];
  for(const pending of state.pendingOrders??[]){
    try{
      const found=await orderByLabel(pending.currency,pending.label);
      const snapshot=await account(pending.currency);
      const position=findActivePosition(snapshot.positions,pending.instrumentName);
      if(found||position){
        if(pending.side==="buy"&&position)state.managedInstruments=[...new Set([...(state.managedInstruments??[]),pending.instrumentName])];
        if(pending.side==="sell"&&!position)state.managedInstruments=(state.managedInstruments??[]).filter(name=>name!==pending.instrumentName);
        journal({type:"PENDING_ORDER_RECONCILED",currency:pending.currency,instrumentName:pending.instrumentName,label:pending.label,positionRecovered:Boolean(position),orderId:found?.order?.order_id});
        continue;
      }
      const checks=Number(pending.checks??0)+1,age=Date.now()-Date.parse(pending.createdAt);
      if(checks>=3&&age>=180_000){journal({type:"PENDING_ORDER_NOT_FOUND_CONFIRMED",currency:pending.currency,instrumentName:pending.instrumentName,label:pending.label,checks});continue;}
      unresolved.push({...pending,checks,lastCheckedAt:new Date().toISOString()});
    }catch(error){unresolved.push({...pending,lastError:errorMessage(error),lastCheckedAt:new Date().toISOString()});}
  }
  state.pendingOrders=unresolved;
  return unresolved.length;
}

async function cancelBotOrders(orders,currency){
  for(const order of orders.filter(item=>String(item.label).startsWith("CV2-AI-"))){
    await privateRpc("private/cancel",{order_id:order.order_id});
    journal({type:"ORDER_CANCELLED_ON_HALT",currency,orderId:order.order_id});
  }
}

async function closeManagedPosition(position,currency,reason){
  const ticker=await rpc("public/ticker",{instrument_name:position.instrument_name});
  const bid=ticker.best_bid_price;
  if(!(bid>0))return{fullyClosed:false,remainingSize:Math.abs(Number(position.size??0)),filledAmount:0};
  const instrument=await rpc("public/get_instrument",{instrument_name:position.instrument_name});
  const precision=(String(instrument.tick_size).split(".")[1]??"").length,price=Number((Math.floor(bid/instrument.tick_size)*instrument.tick_size).toFixed(precision));
  const label=`CV2-AI-EXIT-${currency}-${Date.now()}`.slice(0,64);
  const result=await submitPrivateOrder("private/sell",{instrument_name:position.instrument_name,amount:Math.abs(position.size),type:"limit",price,time_in_force:"immediate_or_cancel",reduce_only:true,label},{currency,label,instrumentName:position.instrument_name,side:"sell"});
  const snapshot=await account(currency);
  const remaining=findActivePosition(snapshot.positions,position.instrument_name);
  const remainingSize=Math.abs(Number(remaining?.size??0)),fill=filledAmount(result),fullyClosed=remainingSize===0;
  journal({type:fullyClosed?"AUTONOMOUS_EXIT":"AUTONOMOUS_EXIT_PARTIAL",currency,instrumentName:position.instrument_name,reason,price,filledAmount:fill,remainingSize,orderId:result.order?.order_id,orderState:result.order?.order_state,label,reconciled:Boolean(result.reconciled)});
  return{fullyClosed,remainingSize,filledAmount:fill};
}

async function evaluateCurrency(currency,cfg,policy,reconciliationRequired){
  const chart=await candles(currency),signal=evaluateSignal(chart,cfg.minimumScore);
  let snapshot={positions:[],orders:[]};
  if(policy.manageExits)snapshot=await account(currency);
  const botOrders=snapshot.orders.filter(item=>String(item.label).startsWith("CV2-AI-"));
  const managed=snapshot.positions.filter(item=>Math.abs(Number(item.size??0))>0&&(state.managedInstruments??[]).includes(item.instrument_name));
  if((!cfg.enabled||!policy.allowEntries)&&botOrders.length)await cancelBotOrders(botOrders,currency);
  let exitTriggered=false;
  if(policy.manageExits){
    for(const position of managed){
      const pnlPct=position.average_price?((position.mark_price-position.average_price)/position.average_price)*100:0;
      const optionType=String(position.instrument_name).endsWith("-C")?"call":"put";
      const opposite=(optionType==="call"&&signal.action==="BUY_PUT")||(optionType==="put"&&signal.action==="BUY_CALL");
      const reason=pnlPct<=-cfg.stopLossPct?"STOP_LOSS":pnlPct>=cfg.takeProfitPct?"TAKE_PROFIT":opposite?"OPPOSITE_SIGNAL":null;
      if(reason){
        exitTriggered=true;
        const result=await closeManagedPosition(position,currency,reason);
        if(result.fullyClosed)state.managedInstruments=(state.managedInstruments??[]).filter(name=>name!==position.instrument_name);
      }
    }
  }
  const dailyTrades=dailyTradeCountForCurrency(state.tradesToday,currency);
  const risk=exitTriggered?{allowed:false,reason:"EXIT_EXECUTED_WAIT_NEXT_CYCLE"}:reconciliationRequired?{allowed:false,reason:"ORDER_RECONCILIATION_REQUIRED"}:riskDecision({signal,config:cfg,positions:managed.length,openOrders:botOrders.length,dailyTrades,lastTradeAt:state.lastTradeAt??0});
  const decision={currency,...signal,risk:risk.reason,executionEligible:Boolean(policy.allowEntries&&risk.allowed)};
  if(decision.executionEligible){
    if(!config().enabled){decision.executionEligible=false;decision.risk="HALT_DETECTED_BEFORE_ORDER";return{decision,positionCount:managed.length,openOrderCount:botOrders.length};}
    const option=await chooseOption(currency,signal.action,signal.price,cfg.maxPremiumUsd);
    if(!option){decision.risk="NO_OPTION_WITHIN_PREMIUM_CAP";return{decision,positionCount:managed.length,openOrderCount:botOrders.length};}
    const label=`CV2-AI-${currency}-${Date.now()}`.slice(0,64);
    const result=await submitPrivateOrder("private/buy",{instrument_name:option.instrumentName,amount:option.amount,type:"limit",price:option.price,time_in_force:"immediate_or_cancel",label},{currency,label,instrumentName:option.instrumentName,side:"buy"});
    const fill=filledAmount(result),order=result.order??{};
    if(fill>0){
      journal({type:"AUTONOMOUS_ENTRY",currency,signal,option,filledAmount:fill,orderId:order.order_id,orderState:order.order_state,label,reconciled:Boolean(result.reconciled)});
      state.lastTradeAt=Date.now();
      state.tradesToday.push({timestamp:new Date().toISOString(),currency,instrumentName:option.instrumentName,orderId:order.order_id});
      state.managedInstruments=[...new Set([...(state.managedInstruments??[]),option.instrumentName])];
    }else journal({type:"AUTONOMOUS_ENTRY_UNFILLED",currency,signal,option,orderId:order.order_id,orderState:order.order_state,label});
  }
  return{decision,positionCount:managed.length,openOrderCount:botOrders.length};
}

async function evaluate(){
  loadEnv();
  const cfg=config(),executionGate=process.env.DERIBIT_AUTOBOT_TESTNET_ROUTING==="true",credentials=Boolean(process.env.DERIBIT_TESTNET_CLIENT_ID&&process.env.DERIBIT_TESTNET_CLIENT_SECRET);
  const today=new Date().toISOString().slice(0,10);
  state.tradesToday=(state.tradesToday??[]).filter(item=>String(item.timestamp).startsWith(today));
  const policy=executionPolicy({executionGate,credentials,entryEnabled:cfg.enabled});
  const reconciliationRequired=credentials?(await reconcilePendingOrders())>0:(state.pendingOrders??[]).length>0;
  const decisions=[],errors=[];
  for(const currency of cfg.currencies){
    try{
      const result=await evaluateCurrency(currency,cfg,policy,reconciliationRequired||(state.pendingOrders??[]).length>0);
      decisions.push(result.decision);
      state.currencyPositionCounts[currency]=result.positionCount;
      state.currencyOrderCounts[currency]=result.openOrderCount;
      state.currencyHealth[currency]={ok:true,lastSuccess:new Date().toISOString(),error:null};
    }catch(error){
      const message=errorMessage(error);
      errors.push(`${currency}:${message}`);
      decisions.push({currency,action:"HOLD",score:50,reason:"CURRENCY_EVALUATION_ERROR",risk:"CURRENCY_EVALUATION_ERROR",executionEligible:false});
      state.currencyHealth[currency]={ok:false,lastSuccess:state.currencyHealth[currency]?.lastSuccess??null,error:message,lastErrorAt:new Date().toISOString()};
      journal({type:"CURRENCY_ENGINE_ERROR",currency,message});
    }
  }
  const now=new Date().toISOString(),error=errors.length?errors.join(" | "):null;
  state={...state,environment:"DERIBIT_TESTNET",workerOnline:true,executionGate,configured:credentials,enabled:policy.allowEntries,exitManagementActive:policy.manageExits,lastHeartbeat:now,lastEvaluation:now,nextEvaluation:new Date(Date.now()+60_000).toISOString(),decisions,positionCount:Object.values(state.currencyPositionCounts).reduce((sum,value)=>sum+Number(value??0),0),openOrderCount:Object.values(state.currencyOrderCounts).reduce((sum,value)=>sum+Number(value??0),0),error,degraded:Boolean(error||reconciliationRequired),reconciliationRequired,pid:process.pid,evaluationInFlight:false};
  if(error){state.totalErrorCycles=Number(state.totalErrorCycles??0)+1;state.consecutiveErrorCycles=Number(state.consecutiveErrorCycles??0)+1;}
  else{state.consecutiveErrorCycles=0;state.lastSuccessfulEvaluation=now;}
  persistState("EVALUATION");
}

async function cycle(){
  if(cycleInFlight){state.skippedCycles=Number(state.skippedCycles??0)+1;state.lastSkippedCycle=new Date().toISOString();persistState("OVERLAP_SKIPPED");return;}
  cycleInFlight=true;state.evaluationInFlight=true;
  try{await evaluate();}
  catch(error){state={...state,environment:"DERIBIT_TESTNET",workerOnline:true,enabled:false,degraded:true,evaluationInFlight:false,lastHeartbeat:new Date().toISOString(),error:errorMessage(error),totalErrorCycles:Number(state.totalErrorCycles??0)+1,consecutiveErrorCycles:Number(state.consecutiveErrorCycles??0)+1,pid:process.pid};persistState("ENGINE_ERROR");journal({type:"ENGINE_ERROR",message:state.error});}
  finally{cycleInFlight=false;state.evaluationInFlight=false;}
}

if(!fs.existsSync(CONFIG_PATH))atomicWriteJson(CONFIG_PATH,DEFAULT_CONFIG);
loadEnv();
journal({type:"WORKER_STARTED",pid:process.pid,executionGate:process.env.DERIBIT_AUTOBOT_TESTNET_ROUTING==="true",version:"v2"});
await cycle();
setInterval(()=>void cycle(),60_000);
setInterval(()=>{state.lastHeartbeat=new Date().toISOString();state.workerOnline=true;persistState("HEARTBEAT");},10_000);
