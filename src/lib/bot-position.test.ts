import { describe,expect,it } from "vitest";
import { calculateExitLevels, positionGreek, positionPremiumUsd } from "./bot-position";

describe("bot position exit levels",()=>{
  it("calculates long-option stop and take-profit from average premium",()=>{
    const result=calculateExitLevels(.017,.016,30,50);
    expect(result.stopPrice).toBeCloseTo(.0119);
    expect(result.takeProfitPrice).toBeCloseTo(.0255);
    expect(result.pnlPct).toBeCloseTo(-5.88235);
  });
  it("does not produce non-finite percentages for a zero entry",()=>{
    const result=calculateExitLevels(0,0,30,50);
    expect(result.pnlPct).toBe(0);
    expect(Number.isFinite(result.distanceToStopPct)).toBe(true);
  });
  it("scales per-contract USD premium and ticker Greeks by position size",()=>{
    expect(positionPremiumUsd(480,.006,80_000,.1)).toBe(48);
    expect(positionPremiumUsd(undefined,.006,80_000,.1)).toBe(48);
    expect(positionGreek(-.2,-.02,.1)).toBeCloseTo(-.02);
    expect(positionGreek(undefined,-.02,.1)).toBeCloseTo(-.02);
  });
});
