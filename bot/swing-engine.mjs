import { atr, ema, rsi } from "./engine.mjs";

export const SWING_POLICY = Object.freeze({
  id:"SWING-TREND-BREAKOUT-V1",
  timeframe:"6H",
  minimumScore:75,
  breakoutBars:30,
  stopAtr:2,
  targetAtr:3.5,
  maxHoldingBars:42,
  cooldownBars:4,
  feeBpsPerSide:5,
  slippageBpsPerSide:5,
});

function validChart(chart,minimum=90){
  return chart&&[chart.open,chart.high,chart.low,chart.close].every(values=>Array.isArray(values)&&values.length>=minimum)&&chart.open.length===chart.close.length&&chart.high.length===chart.close.length&&chart.low.length===chart.close.length;
}

export function evaluateCompletedSwingSignal(chart,policy=SWING_POLICY){
  if(!validChart(chart))return{action:"HOLD",score:50,reason:"INSUFFICIENT_COMPLETED_CANDLES"};
  const {high,low,close,ticks=[]}=chart,price=close.at(-1);
  const ema21=ema(close.slice(-100),21),ema55=ema(close.slice(-140),55),rsi14=rsi(close,14),atr14=atr(high,low,close,14);
  const atrPct=price?atr14/price*100:0,momentum6=(price/close.at(-7)-1)*100;
  const priorHigh=Math.max(...high.slice(-(policy.breakoutBars+1),-1)),priorLow=Math.min(...low.slice(-(policy.breakoutBars+1),-1));
  let score=50;
  score+=ema21>ema55?20:-20;
  score+=price>ema21?10:-10;
  score+=momentum6>2?10:momentum6<-2?-10:0;
  score+=rsi14>=52&&rsi14<=70?10:rsi14<=48&&rsi14>=30?-10:0;
  const bullBreakout=price>priorHigh,bearBreakout=price<priorLow;
  score+=bullBreakout?15:bearBreakout?-15:0;
  score=Math.max(0,Math.min(100,Math.round(score)));
  const volatilityAllowed=atrPct>=.35&&atrPct<=8;
  const action=!volatilityAllowed?"HOLD":bullBreakout&&score>=policy.minimumScore?"BUY_CALL":bearBreakout&&score<=100-policy.minimumScore?"BUY_PUT":"HOLD";
  return{action,score,price,ema21,ema55,rsi:rsi14,atr:atr14,atrPct,momentum6BarsPct:momentum6,breakoutHigh:priorHigh,breakoutLow:priorLow,candleTimestamp:ticks.at(-1)??null,reason:!volatilityAllowed?"VOLATILITY_OUTSIDE_SWING_ENVELOPE":action==="HOLD"?"SWING_SCORE_BELOW_THRESHOLD":"SWING_TREND_BREAKOUT_ALIGNED"};
}

export function evaluateSwingSignal(chart,policy=SWING_POLICY){
  if(!validChart(chart,91))return{action:"HOLD",score:50,reason:"INSUFFICIENT_COMPLETED_CANDLES"};
  return evaluateCompletedSwingSignal({open:chart.open.slice(0,-1),high:chart.high.slice(0,-1),low:chart.low.slice(0,-1),close:chart.close.slice(0,-1),ticks:(chart.ticks??[]).slice(0,-1)},policy);
}

function closeTrade(position,exitPrice,exitIndex,exitTimestamp,reason,policy){
  const rawReturnPct=position.direction*(exitPrice-position.entryPrice)/position.entryPrice*100;
  const netReturnPct=rawReturnPct-policy.feeBpsPerSide*2/100;
  return{...position,exitIndex,exitTimestamp,exitPrice,reason,holdingBars:exitIndex-position.entryIndex+1,rawReturnPct,netReturnPct};
}

export function backtestSwing(chart,overrides={}){
  const policy={...SWING_POLICY,...overrides};
  if(!validChart(chart,140))throw new Error("INSUFFICIENT_BACKTEST_CANDLES");
  const trades=[];let position=null,nextEntrySignalIndex=90;
  const slip=policy.slippageBpsPerSide/10_000;
  for(let index=90;index<chart.close.length-1;index+=1){
    const completed={open:chart.open.slice(0,index+1),high:chart.high.slice(0,index+1),low:chart.low.slice(0,index+1),close:chart.close.slice(0,index+1),ticks:(chart.ticks??[]).slice(0,index+1)};
    const signal=evaluateCompletedSwingSignal(completed,policy);let closed=false;
    if(position&&index>=position.entryIndex){
      const stopHit=position.direction===1?chart.low[index]<=position.stopPrice:chart.high[index]>=position.stopPrice;
      const targetHit=position.direction===1?chart.high[index]>=position.targetPrice:chart.low[index]<=position.targetPrice;
      let exitPrice=null,reason=null,exitIndex=index;
      if(stopHit){exitPrice=position.stopPrice*(1-position.direction*slip);reason="ATR_STOP";}
      else if(targetHit){exitPrice=position.targetPrice*(1-position.direction*slip);reason="ATR_TARGET";}
      else if(index-position.entryIndex+1>=policy.maxHoldingBars){exitIndex=index+1;exitPrice=chart.open[index+1]*(1-position.direction*slip);reason="MAX_HOLD";}
      else if((position.direction===1&&signal.action==="BUY_PUT")||(position.direction===-1&&signal.action==="BUY_CALL")){exitIndex=index+1;exitPrice=chart.open[index+1]*(1-position.direction*slip);reason="OPPOSITE_SIGNAL";}
      if(reason){trades.push(closeTrade(position,exitPrice,exitIndex,chart.ticks?.[exitIndex]??null,reason,policy));position=null;closed=true;nextEntrySignalIndex=exitIndex+policy.cooldownBars;}
    }
    if(!position&&!closed&&index>=nextEntrySignalIndex&&(signal.action==="BUY_CALL"||signal.action==="BUY_PUT")){
      const direction=signal.action==="BUY_CALL"?1:-1,entryIndex=index+1,entryPrice=chart.open[entryIndex]*(1+direction*slip);
      position={direction,side:direction===1?"CALL_PROXY":"PUT_PROXY",signalIndex:index,signalTimestamp:chart.ticks?.[index]??null,entryIndex,entryTimestamp:chart.ticks?.[entryIndex]??null,entryPrice,stopPrice:entryPrice-direction*policy.stopAtr*signal.atr,targetPrice:entryPrice+direction*policy.targetAtr*signal.atr,signalScore:signal.score};
    }
  }
  if(position){const last=chart.close.length-1,exitPrice=chart.close[last]*(1-position.direction*slip);trades.push(closeTrade(position,exitPrice,last,chart.ticks?.[last]??null,"END_OF_DATA",policy));}
  let equity=1,peak=1,maxDrawdownPct=0,grossProfit=0,grossLoss=0;
  for(const trade of trades){const value=trade.netReturnPct/100;equity*=1+value;peak=Math.max(peak,equity);maxDrawdownPct=Math.max(maxDrawdownPct,(peak-equity)/peak*100);if(value>=0)grossProfit+=value;else grossLoss-=value;}
  const wins=trades.filter(trade=>trade.netReturnPct>0).length,totalNetPct=trades.reduce((sum,trade)=>sum+trade.netReturnPct,0);
  return{policy,trades,metrics:{tradeCount:trades.length,wins,losses:trades.length-wins,winRatePct:trades.length?wins/trades.length*100:0,expectancyPct:trades.length?totalNetPct/trades.length:0,profitFactor:grossLoss?grossProfit/grossLoss:grossProfit?Infinity:0,totalCompoundedReturnPct:(equity-1)*100,maxDrawdownPct,averageHoldingBars:trades.length?trades.reduce((sum,trade)=>sum+trade.holdingBars,0)/trades.length:0,longTrades:trades.filter(trade=>trade.direction===1).length,shortTrades:trades.filter(trade=>trade.direction===-1).length}};
}

export function promotionDecision(results){
  const combined=results.reduce((acc,result)=>({tradeCount:acc.tradeCount+result.metrics.tradeCount,wins:acc.wins+result.metrics.wins,totalNet:acc.totalNet+result.trades.reduce((sum,trade)=>sum+trade.netReturnPct,0),grossProfit:acc.grossProfit+result.trades.filter(trade=>trade.netReturnPct>0).reduce((sum,trade)=>sum+trade.netReturnPct,0),grossLoss:acc.grossLoss-result.trades.filter(trade=>trade.netReturnPct<0).reduce((sum,trade)=>sum+trade.netReturnPct,0),maxDrawdownPct:Math.max(acc.maxDrawdownPct,result.metrics.maxDrawdownPct)}),{tradeCount:0,wins:0,totalNet:0,grossProfit:0,grossLoss:0,maxDrawdownPct:0});
  const metrics={tradeCount:combined.tradeCount,winRatePct:combined.tradeCount?combined.wins/combined.tradeCount*100:0,expectancyPct:combined.tradeCount?combined.totalNet/combined.tradeCount:0,profitFactor:combined.grossLoss?combined.grossProfit/combined.grossLoss:combined.grossProfit?Infinity:0,maxDrawdownPct:combined.maxDrawdownPct};
  const blockers=[];
  if(metrics.tradeCount<50)blockers.push("INSUFFICIENT_BACKTEST_SAMPLE");
  if(results.some(result=>result.metrics.tradeCount<15))blockers.push("INSUFFICIENT_PER_ASSET_SAMPLE");
  if(metrics.expectancyPct<=0)blockers.push("NON_POSITIVE_EXPECTANCY");
  if(metrics.profitFactor<1.15)blockers.push("PROFIT_FACTOR_BELOW_1_15");
  if(metrics.maxDrawdownPct>15)blockers.push("DRAWDOWN_ABOVE_15_PERCENT");
  return{eligibleForTestnetForward:!blockers.length,liveAuthorized:false,metrics,blockers};
}
