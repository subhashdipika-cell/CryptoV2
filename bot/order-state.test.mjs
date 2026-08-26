import { describe, expect, it } from "vitest";
import { filledAmount, findActivePosition, isAmbiguousTransportError } from "./order-state.mjs";

describe("autobot order state", () => {
  it("uses actual fills and handles partial executions", () => {
    expect(filledAmount({ order:{ filled_amount:.4 }, trades:[{ amount:.1 },{ amount:.2 }] })).toBe(.4);
    expect(filledAmount({ trades:[{ amount:.1 },{ amount:.2 }] })).toBeCloseTo(.3);
    expect(filledAmount({ order:{ filled_amount:0 }, trades:[] })).toBe(0);
  });

  it("keeps ownership while any position size remains", () => {
    const positions=[{instrument_name:"BTC-X",size:.04},{instrument_name:"ETH-X",size:0}];
    expect(findActivePosition(positions,"BTC-X")?.size).toBe(.04);
    expect(findActivePosition(positions,"ETH-X")).toBeNull();
  });

  it("distinguishes ambiguous transport failures from exchange rejections", () => {
    expect(isAmbiguousTransportError(new Error("The operation was aborted due to timeout"))).toBe(true);
    expect(isAmbiguousTransportError(new Error("price_too_low"))).toBe(false);
  });
});
