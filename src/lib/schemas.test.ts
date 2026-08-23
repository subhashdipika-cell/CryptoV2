import { describe, expect, it } from "vitest";
import { paperOrderSchema } from "./schemas";

describe("paper execution boundary", () => {
  const base = { idempotencyKey: crypto.randomUUID(), exchange:"binance",symbol:"BTCUSDT",side:"BUY",type:"MARKET",quantity:.01,leverage:2,stopLoss:110000 };
  it("accepts an explicit paper order",()=>expect(paperOrderSchema.safeParse({...base,executionMode:"PAPER"}).success).toBe(true));
  it("rejects live execution",()=>expect(paperOrderSchema.safeParse({...base,executionMode:"LIVE"}).success).toBe(false));
  it("requires a stop loss",()=>expect(paperOrderSchema.safeParse({...base,executionMode:"PAPER",stopLoss:undefined}).success).toBe(false));
});
