import { describe,expect,it } from "vitest";
import { blackScholes,deribitOptionFeeUsd,modelOptionTrade,summarizeOptionTrades } from "./options-proxy.mjs";

describe("options-aware swing proxy",()=>{
  it("models theta decay at unchanged spot and IV",()=>{const long=blackScholes({spot:100,strike:100,timeYears:45/365,volatility:.6,type:"call"}),short=blackScholes({spot:100,strike:100,timeYears:15/365,volatility:.6,type:"call"});expect(short).toBeLessThan(long);});
  it("implements the Deribit underlying fee with the premium cap",()=>{expect(deribitOptionFeeUsd(100_000,10)).toBe(1.25);expect(deribitOptionFeeUsd(100_000,1000)).toBeCloseTo(30);});
  it("includes IV, theta, spreads, fees, liquidity, and executed spot levels",()=>{const close=Array.from({length:260},(_,index)=>100+index*.1+Math.sin(index/3));const chart={open:close,high:close.map(x=>x+1),low:close.map(x=>x-1),close};const trade=modelOptionTrade({direction:1,entryIndex:180,exitIndex:220,holdingBars:41,entryPrice:120,exitPrice:130},chart);expect(trade.entrySpot).toBe(120);expect(trade.exitSpot).toBe(130);expect(trade.entryIv).toBeGreaterThan(0);expect(trade.remainingDte).toBeLessThan(trade.dte);expect(trade.entryAsk).toBeGreaterThan(trade.entryMid);expect(trade.entryFee).toBeGreaterThan(0);expect(summarizeOptionTrades([trade]).signalTrades).toBe(1);});
});
