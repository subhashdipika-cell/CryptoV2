import { walkForward,WALK_FORWARD_CANDIDATES } from "../bot/regime-swing.mjs";
import { modelOptionTrade,summarizeOptionTrades } from "../bot/options-proxy.mjs";

const API="https://test.deribit.com/api/v2/public/get_tradingview_chart_data";
const days=Number(process.argv.find(value=>value.startsWith("--days="))?.split("=")[1]??730),end=Date.now(),start=end-days*86_400_000;

async function load(currency){
  const url=new URL(API);url.searchParams.set("instrument_name",`${currency}-PERPETUAL`);url.searchParams.set("start_timestamp",String(start));url.searchParams.set("end_timestamp",String(end));url.searchParams.set("resolution","360");
  const response=await fetch(url,{signal:AbortSignal.timeout(30_000)}),body=await response.json().catch(()=>null);
  if(!response.ok||body?.error)throw new Error(`${currency}_${body?.error?.message??`HTTP_${response.status}`}`);
  if(body.result?.status!=="ok")throw new Error(`${currency}_INVALID_CHART_DATA`);return body.result;
}
function clean(value){return JSON.parse(JSON.stringify(value,(_,item)=>item===Infinity?999:item));}

const charts=[];for(const currency of ["BTC","ETH"])charts.push({currency,chart:await load(currency)});
const walk=walkForward(charts),optionTrades=[];
for(const fold of walk.folds)for(const asset of fold.testResults)for(const trade of asset.result.trades)optionTrades.push(modelOptionTrade(trade,asset.chart));
const optionMetrics=summarizeOptionTrades(optionTrades),blockers=[];
if(walk.metrics.tradeCount<30)blockers.push("INSUFFICIENT_OUT_OF_SAMPLE_SIGNALS");
if(walk.metrics.expectancyPct<=0)blockers.push("DIRECTIONAL_OOS_EXPECTANCY_NOT_POSITIVE");
if(walk.metrics.profitFactor<1.15)blockers.push("DIRECTIONAL_OOS_PROFIT_FACTOR_BELOW_1_15");
if(walk.metrics.maxDrawdownPct>20)blockers.push("DIRECTIONAL_OOS_DRAWDOWN_ABOVE_20_PERCENT");
if(optionMetrics.tradeCount<30)blockers.push("INSUFFICIENT_MODELED_OPTION_TRADES");
if(optionMetrics.expectancyPct<=0)blockers.push("OPTION_PROXY_EXPECTANCY_NOT_POSITIVE");
if(optionMetrics.profitFactor<1.15)blockers.push("OPTION_PROXY_PROFIT_FACTOR_BELOW_1_15");
if(optionMetrics.maxDrawdownPct>25)blockers.push("OPTION_PROXY_DRAWDOWN_ABOVE_25_PERCENT");
blockers.push("HISTORICAL_OPTION_BOOKS_NOT_RECORDED");

const report=clean({
  strategy:{id:"REGIME-SWING-WF-V2",timeframe:"6H",selection:"Rolling 365-day training and 91-day out-of-sample tests",candidateCount:WALK_FORWARD_CANDIDATES.length},
  generatedAt:new Date().toISOString(),
  data:{source:"Deribit Testnet public BTC/ETH perpetual 6H OHLC",from:new Date(Math.min(...charts.map(item=>item.chart.ticks[0]))).toISOString(),to:new Date(Math.max(...charts.map(item=>item.chart.ticks.at(-1)))).toISOString(),candlesByAsset:Object.fromEntries(charts.map(item=>[item.currency,item.chart.close.length]))},
  directional:{executionModel:"Completed-candle regime breakout; selected on prior training only; next-bar execution; stop-first ambiguity; 5 bps fee plus 5 bps slippage per side",metrics:walk.metrics},
  optionsProxy:{model:"ATM 45-DTE Black-Scholes proxy; IV from 30-day realized volatility x 1.15; theta through time-to-expiry repricing; synthetic bid/ask spread and liquidity gate",feeModel:"MIN(0.0003 x underlying, 12.5% x option premium) per side",limitations:["No historical expired-option bid/ask or open-interest archive","No historical Deribit mark-IV surface","Modeled USD-equivalent inverse option premium"],metrics:optionMetrics},
  folds:walk.folds.map(fold=>({fold:fold.fold,trainFrom:new Date(charts[0].chart.ticks[fold.trainStart]).toISOString(),trainTo:new Date(charts[0].chart.ticks[fold.trainEnd]).toISOString(),testFrom:new Date(charts[0].chart.ticks[fold.testStart]).toISOString(),testTo:new Date(charts[0].chart.ticks[fold.testEnd]).toISOString(),selectedPolicy:fold.selectedPolicy,trainingMetrics:fold.trainingMetrics,testMetrics:Object.fromEntries(fold.testResults.map(item=>[item.currency,item.result.metrics]))})),
  promotion:{status:"MODEL_RESEARCH_BLOCKED",eligibleForTestnetForward:false,routingEnabled:false,liveAuthorized:false,blockers},
});
if(!process.argv.includes("--summary")){report.directional.trades=walk.trades;report.optionsProxy.trades=optionTrades;}
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
