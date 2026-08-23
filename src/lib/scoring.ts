import type { Market, ScreenerCondition } from "./types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function scoreMarket(market: Market) {
  const momentum = clamp(50 + market.change * 4);
  const openInterest = clamp(50 + market.oiChange * 3);
  const fundingBalance = clamp(50 - Math.abs(market.funding) * 1000);
  const rsiQuality = clamp(100 - Math.abs(55 - market.rsi) * 2.2);
  const score = Math.round(momentum * 0.35 + openInterest * 0.3 + fundingBalance * 0.15 + rsiQuality * 0.2);
  const action = score >= 78 ? "Strong Buy" : score >= 62 ? "Buy" : score <= 28 ? "Strong Sell" : score <= 42 ? "Sell" : "Neutral";
  return { score, action };
}

export function evaluateCondition(market: Market, condition: ScreenerCondition) {
  const current = market[condition.field];
  switch (condition.operator) {
    case ">": return current > condition.value;
    case "<": return current < condition.value;
    case ">=": return current >= condition.value;
    case "<=": return current <= condition.value;
    case "=": return current === condition.value;
  }
}

export function screenMarkets(source: Market[], conditions: ScreenerCondition[], logic: "AND" | "OR" = "AND") {
  return source.filter((market) => logic === "AND"
    ? conditions.every((condition) => evaluateCondition(market, condition))
    : conditions.some((condition) => evaluateCondition(market, condition)));
}
