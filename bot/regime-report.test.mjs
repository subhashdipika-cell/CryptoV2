import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

const report=JSON.parse(readFileSync(new URL("../reports/regime-swing-walkforward.json",import.meta.url),"utf8"));
describe("regime swing evidence gate",()=>{
  it("cannot authorize routing from modeled evidence",()=>{expect(report.promotion.status).toBe("MODEL_RESEARCH_BLOCKED");expect(report.promotion.eligibleForTestnetForward).toBe(false);expect(report.promotion.routingEnabled).toBe(false);expect(report.promotion.liveAuthorized).toBe(false);expect(report.promotion.blockers).toContain("HISTORICAL_OPTION_BOOKS_NOT_RECORDED");});
  it("records both directional and option risk evidence",()=>{expect(report.directional.metrics.tradeCount).toBe(24);expect(report.optionsProxy.metrics.tradeCount).toBe(24);expect(report.optionsProxy.metrics.maxDrawdownPct).toBeGreaterThan(25);});
});
