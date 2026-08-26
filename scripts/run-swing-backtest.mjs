import { backtestSwing,promotionDecision,SWING_POLICY } from "../bot/swing-engine.mjs";

const API="https://test.deribit.com/api/v2/public/get_tradingview_chart_data";
const days=Number(process.argv.find(value=>value.startsWith("--days="))?.split("=")[1]??730);
const end=Date.now(),start=end-days*86_400_000;

async function load(currency){
  const url=new URL(API);url.searchParams.set("instrument_name",`${currency}-PERPETUAL`);url.searchParams.set("start_timestamp",String(start));url.searchParams.set("end_timestamp",String(end));url.searchParams.set("resolution","360");
  const response=await fetch(url,{signal:AbortSignal.timeout(30_000)});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(`${currency}_HTTP_${response.status}_${body?.error?.message??"UNKNOWN"}`);
  if(body.error)throw new Error(`${currency}_${body.error.message??body.error.code}`);
  const result=body.result;if(result?.status!=="ok"||!Array.isArray(result.close))throw new Error(`${currency}_INVALID_CHART_DATA`);
  return result;
}

function serializable(value){return JSON.parse(JSON.stringify(value,(_,item)=>item===Infinity?999:item));}

const assets=[];
for(const currency of ["BTC","ETH"]){
  const chart=await load(currency),full=backtestSwing(chart),holdoutStart=Math.max(0,Math.floor(chart.close.length/2)-100);
  const holdoutChart=Object.fromEntries(Object.entries(chart).map(([key,value])=>[key,Array.isArray(value)?value.slice(holdoutStart):value]));
  const holdout=backtestSwing(holdoutChart);
  assets.push({currency,candles:chart.close.length,from:new Date(chart.ticks[0]).toISOString(),to:new Date(chart.ticks.at(-1)).toISOString(),full:{metrics:full.metrics,trades:full.trades},holdout:{from:new Date(holdoutChart.ticks[0]).toISOString(),metrics:holdout.metrics}});
}
const promotion=promotionDecision(assets.map(asset=>({metrics:asset.full.metrics,trades:asset.full.trades})));
const report=serializable({strategy:SWING_POLICY,generatedAt:new Date().toISOString(),dataSource:"Deribit Testnet public BTC/ETH perpetual 6H OHLC",executionModel:"Fresh 30-bar breakout on completed 6H close; entry/exit at next bar open; stop-first when stop and target share a bar",costModel:{feeBpsPerSide:SWING_POLICY.feeBpsPerSide,slippageBpsPerSide:SWING_POLICY.slippageBpsPerSide},scope:"Directional underlying proxy only; not an options premium or volatility replay",assets,promotion:{...promotion,routingEnabled:false,status:promotion.eligibleForTestnetForward?"FORWARD_TEST_CANDIDATE":"RESEARCH_BLOCKED"}});
if(process.argv.includes("--summary"))for(const asset of report.assets)delete asset.full.trades;
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
