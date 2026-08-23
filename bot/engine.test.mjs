import { describe, expect, it } from "vitest";
import { evaluateSignal, riskDecision } from "./engine.mjs";

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
});
