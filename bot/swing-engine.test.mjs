import { describe,expect,it } from "vitest";
import { backtestSwing,evaluateSwingSignal,promotionDecision } from "./swing-engine.mjs";

function chart(direction=1,length=212){
  const close=Array.from({length},(_,index)=>1000+direction*(index*.5+Math.floor(index/35)*20)+Math.sin(index/4));
  return{open:close.map((value,index)=>index?close[index-1]:value),high:close.map(value=>value+4),low:close.map(value=>value-4),close,ticks:close.map((_,index)=>index*21_600_000)};
}

describe("swing engine",()=>{
  it("ignores the unfinished candle",()=>{
    const base=chart(1,130),first=evaluateSwingSignal(base);
    const changed={...base,close:[...base.close.slice(0,-1),1],high:[...base.high.slice(0,-1),500],low:[...base.low.slice(0,-1),.1]};
    expect(evaluateSwingSignal(changed)).toEqual(first);
  });
  it("detects directional 6H trends",()=>{
    expect(evaluateSwingSignal(chart(1)).action).toBe("BUY_CALL");
    expect(evaluateSwingSignal(chart(-1)).action).toBe("BUY_PUT");
  });
  it("uses next-bar execution and deducts costs",()=>{
    const result=backtestSwing(chart(1));
    expect(result.metrics.tradeCount).toBeGreaterThan(0);
    expect(result.trades[0].entryIndex).toBe(result.trades[0].signalIndex+1);
    expect(result.trades[0].netReturnPct).toBeLessThan(result.trades[0].rawReturnPct);
  });
  it("fails promotion when the sample is insufficient",()=>{
    const result=backtestSwing(chart(1,180));
    expect(promotionDecision([result,result]).blockers).toContain("INSUFFICIENT_BACKTEST_SAMPLE");
    expect(promotionDecision([result,result]).liveAuthorized).toBe(false);
  });
});
