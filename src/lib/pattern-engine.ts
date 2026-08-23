export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface Pivot { index: number; price: number; kind: "high" | "low" }

export function extractPivots(candles: Candle[], radius = 3): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = radius; i < candles.length - radius; i++) {
    const window = candles.slice(i - radius, i + radius + 1);
    if (window.every((candle) => candles[i].high >= candle.high)) pivots.push({ index: i, price: candles[i].high, kind: "high" });
    if (window.every((candle) => candles[i].low <= candle.low)) pivots.push({ index: i, price: candles[i].low, kind: "low" });
  }
  return pivots;
}

export function linearFit(points: Pivot[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.price ?? 0, r2: 0 };
  const sx = points.reduce((sum, point) => sum + point.index, 0);
  const sy = points.reduce((sum, point) => sum + point.price, 0);
  const sxy = points.reduce((sum, point) => sum + point.index * point.price, 0);
  const sxx = points.reduce((sum, point) => sum + point.index ** 2, 0);
  const slope = (n * sxy - sx * sy) / Math.max(n * sxx - sx ** 2, Number.EPSILON);
  const intercept = (sy - slope * sx) / n;
  const mean = sy / n;
  const residual = points.reduce((sum, p) => sum + (p.price - (slope * p.index + intercept)) ** 2, 0);
  const total = points.reduce((sum, p) => sum + (p.price - mean) ** 2, 0);
  return { slope, intercept, r2: total ? 1 - residual / total : 1 };
}

export function detectTriangle(candles: Candle[]) {
  const pivots = extractPivots(candles);
  const highs = pivots.filter((pivot) => pivot.kind === "high").slice(-4);
  const lows = pivots.filter((pivot) => pivot.kind === "low").slice(-4);
  if (highs.length < 3 || lows.length < 3) return null;
  const upper = linearFit(highs); const lower = linearFit(lows);
  const scale = candles.at(-1)?.close ?? 1;
  const flatTolerance = 0.0015 * scale;
  if (Math.abs(upper.slope) <= flatTolerance && lower.slope > flatTolerance && upper.r2 > .55 && lower.r2 > .55)
    return { pattern: "Ascending Triangle", direction: "bullish" as const, confidence: Math.round((upper.r2 + lower.r2) * 50) };
  if (Math.abs(lower.slope) <= flatTolerance && upper.slope < -flatTolerance && upper.r2 > .55 && lower.r2 > .55)
    return { pattern: "Descending Triangle", direction: "bearish" as const, confidence: Math.round((upper.r2 + lower.r2) * 50) };
  return null;
}
