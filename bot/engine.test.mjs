import { describe, expect, it } from "vitest";
import { dailyTradeCountForCurrency, evaluateSignal, executionPolicy, riskDecision } from "./engine.mjs";

function candles(direction = 1) {
  const close = Array.from({ length: 81 }, (_, index) => 100 + direction * index * .4);
  return { close, high: close.map(value => value + .2), low: close.map(value => value - .2), ticks: close.map((_, index) => index * 900_000) };
}

describe("autobot signal and risk engine", () => {
  it("uses completed candles and emits a bounded directional score", () => {
    const result = evaluateSignal(candles(1), 70);
    expect(result.action).toBe("BUY_CALL");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.candleTimestamp).toBe(79 * 900_000);
  });
  it("blocks entries when a position already exists", () => {
    expect(riskDecision({ signal:{action:"BUY_CALL"}, config:{maxDailyTrades:2,cooldownMinutes:60}, positions:1, openOrders:0, dailyTrades:0 }).reason).toBe("MAX_OPEN_POSITIONS");
  });
  it("blocks entries during cooldown", () => {
    expect(riskDecision({ signal:{action:"BUY_PUT"}, config:{maxDailyTrades:2,cooldownMinutes:60}, positions:0, openOrders:0, dailyTrades:0, now:100_000,lastTradeAt:99_000 }).reason).toBe("COOLDOWN_ACTIVE");
  });
  it("enforces four daily entries independently for each currency", () => {
    const trades = [
      ...Array.from({ length: 4 }, () => ({ currency:"BTC" })),
      ...Array.from({ length: 3 }, () => ({ currency:"ETH" })),
    ];
    expect(dailyTradeCountForCurrency(trades,"BTC")).toBe(4);
    expect(dailyTradeCountForCurrency(trades,"ETH")).toBe(3);
    expect(riskDecision({ signal:{action:"BUY_CALL"}, config:{maxDailyTrades:4,cooldownMinutes:0}, positions:0, openOrders:0, dailyTrades:4 }).reason).toBe("DAILY_TRADE_CAP");
    expect(riskDecision({ signal:{action:"BUY_CALL"}, config:{maxDailyTrades:4,cooldownMinutes:0}, positions:0, openOrders:0, dailyTrades:3 }).reason).toBe("RISK_CHECKS_PASSED");
  });
  it("continues exit management when new entries are paused", () => {
    expect(executionPolicy({ executionGate:true, credentials:true, entryEnabled:false })).toEqual({ manageExits:true, allowEntries:false });
  });
  it("locks both paths when the Testnet server gate is off", () => {
    expect(executionPolicy({ executionGate:false, credentials:true, entryEnabled:true })).toEqual({ manageExits:false, allowEntries:false });
  });
});
