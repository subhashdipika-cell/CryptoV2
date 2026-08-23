import { describe, expect, it } from "vitest";
import { comboOrderSchema, optionLabel, optionOrderSchema } from "./deribit-schema";

const key = "123e4567-e89b-42d3-a456-426614174000";

describe("Deribit Testnet order schemas", () => {
  it("accepts a bounded single-leg preview", () => {
    expect(optionOrderSchema.parse({ action:"preview", currency:"BTC", instrumentName:"BTC-25SEP26-100000-C", direction:"buy", amount:.1, price:.01, idempotencyKey:key }).confirmTestnet).toBe(false);
  });
  it("rejects production-like currencies and market payload fields", () => {
    expect(optionOrderSchema.safeParse({ action:"submit", currency:"USDC", instrumentName:"BTC-25SEP26-100000-C", direction:"buy", amount:.1, price:.01, idempotencyKey:key, orderType:"market" }).success).toBe(false);
  });
  it("requires two distinct-shaped combo legs within the four-leg cap", () => {
    const base={action:"preview",currency:"ETH",direction:"buy",amount:1,price:0,idempotencyKey:key};
    expect(comboOrderSchema.safeParse({...base,legs:[{instrumentName:"ETH-25SEP26-4000-C",direction:"buy",ratio:1}]}).success).toBe(false);
    expect(comboOrderSchema.safeParse({...base,legs:Array.from({length:5},(_,i)=>({instrumentName:`ETH-25SEP26-${4000+i*100}-C`,direction:"buy",ratio:1}))}).success).toBe(false);
  });
  it("creates a Deribit-safe label", () => {
    expect(optionLabel(key)).toMatch(/^CV2-/);
    expect(optionLabel(key).length).toBeLessThanOrEqual(64);
  });
});
