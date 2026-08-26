import { atr,ema,rsi } from "./engine.mjs";

export const REGIME_POLICY=Object.freeze({id:"REGIME-SWING-WF-V2",timeframe:"6H",minimumScore:80,breakoutBars:40,stopAtr:3,targetAtr:6,maxHoldingBars:56,cooldownBars:4,feeBpsPerSide:5,slippageBpsPerSide:5,minimumTrendSpreadPct:1,minimumAtrPct:.35,maximumAtrPct:8});
export const WALK_FORWARD_CANDIDATES=Object.freeze([20,40,60].flatMap(breakoutBars=>[2,3].flatMap(stopAtr=>[4,6].flatMap(targetAtr=>[28,56].map(maxHoldingBars=>({...REGIME_POLICY,id:`B${breakoutBars}-S${stopAtr}-T${targetAtr}-H${maxHoldingBars}`,breakoutBars,stopAtr,targetAtr,maxHoldingBars}))))));

function valid(chart,minimum=240){return chart&&[chart.open,chart.high,chart.low,chart.close].every(values=>Array.isArray(values)&&values.length>=minimum)&&chart.open.length===chart.close.length&&chart.high.length===chart.close.length&&chart.low.length===chart.close.length;}
function view(chart,end){return{open:chart.open.slice(Math.max(0,end-260),end+1),high:chart.high.slice(Math.max(0,end-260),end+1),low:chart.low.slice(Math.max(0,end-260),end+1),close:chart.close.slice(Math.max(0,end-260),end+1),ticks:(chart.ticks??[]).slice(Math.max(0,end-260),end+1)};}

export function evaluateRegimeAt(chart,index=chart.close.length-1,policy=REGIME_POLICY){
  const data=view(chart,index);if(!valid(data,220))return{action:"HOLD",score:50,reason:"INSUFFICIENT_REGIME_CANDLES"};
  const {close,high,low,ticks=[]}=data,price=close.at(-1),fast=ema(close.slice(-160),50),slow=ema(close.slice(-240),200),priorFast=ema(close.slice(-165,-5),50);
  const rsi14=rsi(close),atr14=atr(high,low,close),atrPct=atr14/price*100,trendSpreadPct=Math.abs(fast/slow-1)*100,fastSlopePct=(fast/priorFast-1)*100;
  const priorHigh=Math.max(...high.slice(-(policy.breakoutBars+1),-1)),priorLow=Math.min(...low.slice(-(policy.breakoutBars+1),-1)),bullBreakout=price>priorHigh,bearBreakout=price<priorLow;
  const bullRegime=price>slow&&fast>slow&&fastSlopePct>.1&&trendSpreadPct>=policy.minimumTrendSpreadPct;
  const bearRegime=price<slow&&fast<slow&&fastSlopePct<-.1&&trendSpreadPct>=policy.minimumTrendSpreadPct;
  const volatilityAllowed=atrPct>=policy.minimumAtrPct&&atrPct<=policy.maximumAtrPct;
  let score=50;score+=fast>slow?20:-20;score+=price>slow?10:-10;score+=fastSlopePct>.1?10:fastSlopePct<-.1?-10:0;score+=rsi14>=50&&rsi14<=72?10:rsi14<50&&rsi14>=28?-10:0;score+=bullBreakout?10:bearBreakout?-10:0;score=Math.max(0,Math.min(100,Math.round(score)));
  const action=!volatilityAllowed?"HOLD":bullRegime&&bullBreakout&&score>=policy.minimumScore?"BUY_CALL":bearRegime&&bearBreakout&&score<=100-policy.minimumScore?"BUY_PUT":"HOLD";
  return{action,score,price,ema50:fast,ema200:slow,ema50SlopePct:fastSlopePct,trendSpreadPct,rsi:rsi14,atr:atr14,atrPct,candleTimestamp:ticks.at(-1)??null,reason:!volatilityAllowed?"VOLATILITY_OUTSIDE_REGIME_ENVELOPE":action==="HOLD"?"REGIME_OR_BREAKOUT_NOT_ALIGNED":"REGIME_BREAKOUT_ALIGNED"};
}

function summarize(trades){
  let equity=1,peak=1,maxDrawdownPct=0,grossProfit=0,grossLoss=0;for(const trade of trades){const value=trade.netReturnPct/100;equity*=Math.max(.0001,1+value);peak=Math.max(peak,equity);maxDrawdownPct=Math.max(maxDrawdownPct,(peak-equity)/peak*100);if(value>=0)grossProfit+=value;else grossLoss-=value;}
  const wins=trades.filter(trade=>trade.netReturnPct>0).length,total=trades.reduce((sum,trade)=>sum+trade.netReturnPct,0);return{tradeCount:trades.length,wins,losses:trades.length-wins,winRatePct:trades.length?wins/trades.length*100:0,expectancyPct:trades.length?total/trades.length:0,profitFactor:grossLoss?grossProfit/grossLoss:grossProfit?Infinity:0,totalCompoundedReturnPct:(equity-1)*100,maxDrawdownPct,averageHoldingBars:trades.length?trades.reduce((sum,trade)=>sum+trade.holdingBars,0)/trades.length:0};
}

export function backtestRegimeSwing(chart,overrides={}){
  const policy={...REGIME_POLICY,...overrides};if(!valid(chart,260))throw new Error("INSUFFICIENT_REGIME_BACKTEST_CANDLES");
  const trades=[];let position=null,nextEntry=220;const slip=policy.slippageBpsPerSide/10_000;
  for(let index=220;index<chart.close.length-1;index+=1){const signal=evaluateRegimeAt(chart,index,policy);let closed=false;
    if(position&&index>=position.entryIndex){const stopHit=position.direction===1?chart.low[index]<=position.stopPrice:chart.high[index]>=position.stopPrice,targetHit=position.direction===1?chart.high[index]>=position.targetPrice:chart.low[index]<=position.targetPrice;let exitPrice=null,reason=null,exitIndex=index;
      if(stopHit){exitPrice=position.stopPrice*(1-position.direction*slip);reason="ATR_STOP";}else if(targetHit){exitPrice=position.targetPrice*(1-position.direction*slip);reason="ATR_TARGET";}else if(index-position.entryIndex+1>=policy.maxHoldingBars){exitIndex=index+1;exitPrice=chart.open[index+1]*(1-position.direction*slip);reason="MAX_HOLD";}else if((position.direction===1&&signal.action==="BUY_PUT")||(position.direction===-1&&signal.action==="BUY_CALL")){exitIndex=index+1;exitPrice=chart.open[index+1]*(1-position.direction*slip);reason="OPPOSITE_REGIME";}
      if(reason){const rawReturnPct=position.direction*(exitPrice-position.entryPrice)/position.entryPrice*100,netReturnPct=rawReturnPct-policy.feeBpsPerSide*2/100;trades.push({...position,exitIndex,exitTimestamp:chart.ticks?.[exitIndex]??null,exitPrice,reason,holdingBars:exitIndex-position.entryIndex+1,rawReturnPct,netReturnPct});position=null;closed=true;nextEntry=exitIndex+policy.cooldownBars;}}
    if(!position&&!closed&&index>=nextEntry&&(signal.action==="BUY_CALL"||signal.action==="BUY_PUT")){const direction=signal.action==="BUY_CALL"?1:-1,entryIndex=index+1,entryPrice=chart.open[entryIndex]*(1+direction*slip);position={direction,side:direction===1?"CALL_PROXY":"PUT_PROXY",signalIndex:index,signalTimestamp:chart.ticks?.[index]??null,entryIndex,entryTimestamp:chart.ticks?.[entryIndex]??null,entryPrice,stopPrice:entryPrice-direction*policy.stopAtr*signal.atr,targetPrice:entryPrice+direction*policy.targetAtr*signal.atr,signalScore:signal.score};}}
  if(position){const exitIndex=chart.close.length-1,exitPrice=chart.close[exitIndex]*(1-position.direction*slip),rawReturnPct=position.direction*(exitPrice-position.entryPrice)/position.entryPrice*100;trades.push({...position,exitIndex,exitTimestamp:chart.ticks?.[exitIndex]??null,exitPrice,reason:"END_OF_DATA",holdingBars:exitIndex-position.entryIndex+1,rawReturnPct,netReturnPct:rawReturnPct-policy.feeBpsPerSide*2/100});}
  return{policy,trades,metrics:summarize(trades)};
}

function combine(results){return summarize(results.flatMap(result=>result.trades));}
function candidateScore(metrics){if(metrics.tradeCount<8)return-1e9;return metrics.expectancyPct+Math.min(metrics.profitFactor,3)-metrics.maxDrawdownPct/20+Math.log10(metrics.tradeCount+1);}

export function walkForward(charts,{trainBars=1460,testBars=365,candidates=WALK_FORWARD_CANDIDATES}={}){
  const length=Math.min(...charts.map(item=>item.chart.close.length)),folds=[];
  for(let testStart=trainBars,fold=1;testStart+120<length;testStart+=testBars,fold+=1){const testEnd=Math.min(length,testStart+testBars),trainStart=Math.max(0,testStart-trainBars);let selected=null,best=-Infinity;
    for(const policy of candidates){const results=charts.map(({chart})=>backtestRegimeSwing(Object.fromEntries(Object.entries(chart).map(([key,value])=>[key,Array.isArray(value)?value.slice(trainStart,testStart):value])),policy)),metrics=combine(results),score=candidateScore(metrics);if(score>best){best=score;selected={policy,metrics};}}
    if(!selected)throw new Error("NO_WALK_FORWARD_POLICY");
    const testResults=charts.map(({currency,chart})=>{const sliceStart=Math.max(0,testStart-220),sliced=Object.fromEntries(Object.entries(chart).map(([key,value])=>[key,Array.isArray(value)?value.slice(sliceStart,testEnd):value])),result=backtestRegimeSwing(sliced,selected.policy);return{currency,chart:sliced,result:{...result,trades:result.trades.map(trade=>({...trade,currency,fold}))}};});
    folds.push({fold,trainStart,trainEnd:testStart-1,testStart,testEnd:testEnd-1,selectedPolicy:selected.policy,trainingMetrics:selected.metrics,testResults});}
  const trades=folds.flatMap(item=>item.testResults.flatMap(result=>result.result.trades));return{folds,trades,metrics:summarize(trades)};
}
