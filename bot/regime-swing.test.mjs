import { describe,expect,it } from "vitest";
import { evaluateRegimeAt,REGIME_POLICY,walkForward } from "./regime-swing.mjs";

function chart(direction=1,length=780){const close=Array.from({length},(_,index)=>2000+direction*(index*.8+Math.floor(index/40)*35)+Math.sin(index/5)*3);return{open:close.map((value,index)=>index?close[index-1]:value),high:close.map(value=>value+7),low:close.map(value=>value-7),close,ticks:close.map((_,index)=>Date.UTC(2024,0,1)+index*21_600_000)};}

describe("regime swing walk-forward",()=>{
  it("requires the long-term regime and a fresh breakout",()=>{const data=chart(1,242);expect(evaluateRegimeAt(data,240,REGIME_POLICY).action).toBe("BUY_CALL");expect(evaluateRegimeAt(data,239,REGIME_POLICY).action).toBe("HOLD");});
  it("keeps every test trade outside its training window",()=>{const charts=[{currency:"BTC",chart:chart(1)},{currency:"ETH",chart:chart(-1)}],candidates=[{...REGIME_POLICY,breakoutBars:20},{...REGIME_POLICY,breakoutBars:40}];const result=walkForward(charts,{trainBars:300,testBars:200,candidates});expect(result.folds.length).toBeGreaterThan(0);for(const fold of result.folds)for(const asset of fold.testResults)for(const trade of asset.result.trades)expect(trade.signalTimestamp).toBeGreaterThanOrEqual(charts[0].chart.ticks[fold.testStart]);});
});
