import { describe, expect, it } from "vitest";
import { markets } from "./mock-data";
import { scoreMarket, screenMarkets } from "./scoring";

describe("market intelligence", () => {
  it("keeps confidence bounded", () => {
    for (const market of markets) expect(scoreMarket(market).score).toBeGreaterThanOrEqual(0);
    for (const market of markets) expect(scoreMarket(market).score).toBeLessThanOrEqual(100);
  });

  it("evaluates compound screener conditions", () => {
    const result = screenMarkets(markets, [
      { field: "rsi", operator: ">", value: 70 },
      { field: "volume", operator: ">", value: 1e9 },
    ]);
    expect(result.map((item) => item.symbol)).toEqual(["SOL", "SUI"]);
  });
});
