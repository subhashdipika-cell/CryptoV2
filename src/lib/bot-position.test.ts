import { describe,expect,it } from "vitest";
import { calculateExitLevels } from "./bot-position";

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
});
