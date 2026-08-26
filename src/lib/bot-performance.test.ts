import { describe, expect, it } from "vitest";
import { calculateBotPerformance } from "./bot-performance";

describe("calculateBotPerformance", () => {
  it("aggregates bot-only net realized and unrealized P&L by UTC period", () => {
    const now = Date.UTC(2026, 7, 24, 12);
    const result = calculateBotPerformance([
      { trade_id:"today", order_id:"today-order", timestamp:Date.UTC(2026,7,24,1), label:"CV2-AI-EXIT-ETH-1", profit_loss:0.01, fee:0.001, fee_currency:"ETH", index_price:2500 },
      { trade_id:"month", order_id:"month-order", timestamp:Date.UTC(2026,7,2), label:"CV2-AI-EXIT-BTC-1", profit_loss:-0.001, fee:0.0001, fee_currency:"BTC", index_price:80000 },
      { trade_id:"old", order_id:"old-order", timestamp:Date.UTC(2026,6,2), label:"CV2-AI-EXIT-BTC-2", profit_loss:0.002, fee:2, fee_currency:"USDC", index_price:75000 },
      { trade_id:"manual", timestamp:Date.UTC(2026,7,24,2), label:"MANUAL", profit_loss:10, fee:0, fee_currency:"ETH", index_price:2500 },
      { trade_id:"today", timestamp:Date.UTC(2026,7,24,1), label:"CV2-AI-ETH-1", profit_loss:0.01, fee:0.001, fee_currency:"ETH", index_price:2500 },
    ], [{ floatingPnlUsd: 5 }], now);

    expect(result.daily).toEqual({ totalUsd:27.5, realizedUsd:22.5, unrealizedUsd:5, tradeCount:1 });
    expect(result.monthly).toEqual({ totalUsd:-60.5, realizedUsd:-65.5, unrealizedUsd:5, tradeCount:2 });
    expect(result.overall).toEqual({ totalUsd:87.5, realizedUsd:82.5, unrealizedUsd:5, tradeCount:3 });
  });

  it("counts a multi-fill exit as one closed position", () => {
    const now=Date.UTC(2026,7,24,12);
    const result=calculateBotPerformance([
      {trade_id:"a",order_id:"exit-1",timestamp:now-1000,label:"CV2-AI-EXIT-BTC-1",profit_loss:.001,index_price:80_000},
      {trade_id:"b",order_id:"exit-1",timestamp:now-900,label:"CV2-AI-EXIT-BTC-1",profit_loss:.001,index_price:80_000},
      {trade_id:"entry",order_id:"entry-2",timestamp:now-800,label:"CV2-AI-BTC-2",profit_loss:0,index_price:80_000},
    ],[],now);
    expect(result.daily.tradeCount).toBe(1);
  });
});
