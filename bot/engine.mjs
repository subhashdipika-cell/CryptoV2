export function ema(values, period) {
  if (!values.length) return 0;
  const alpha = 2 / (period + 1);
  return values.slice(1).reduce((value, item) => item * alpha + value * (1 - alpha), values[0]);
}
export function rsi(values, period = 14) {
  if (values.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change; else losses -= change;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

export function atr(high, low, close, period = 14) {
  if (close.length <= period) return 0;
  const ranges = [];
  for (let index = close.length - period; index < close.length; index += 1) {
    ranges.push(Math.max(high[index] - low[index], Math.abs(high[index] - close[index - 1]), Math.abs(low[index] - close[index - 1])));
  }
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

export function evaluateSignal(candles, minimumScore = 75) {
  const { close, high, low, ticks = [] } = candles;
  if (!Array.isArray(close) || close.length < 60 || high.length !== close.length || low.length !== close.length) {
    return { action: "HOLD", score: 50, reason: "INSUFFICIENT_COMPLETED_CANDLES" };
  }
  const completedClose = close.slice(0, -1), completedHigh = high.slice(0, -1), completedLow = low.slice(0, -1);
  const price = completedClose.at(-1), fast = ema(completedClose.slice(-80), 20), slow = ema(completedClose.slice(-100), 50);
  const momentum = (price / completedClose.at(-5) - 1) * 100, rsiValue = rsi(completedClose), atrValue = atr(completedHigh, completedLow, completedClose);
  const atrPct = price ? atrValue / price * 100 : 0;
  let score = 50;
  score += fast > slow ? 18 : -18;
  score += momentum > .25 ? 14 : momentum < -.25 ? -14 : 0;
  score += rsiValue >= 55 && rsiValue <= 72 ? 12 : rsiValue <= 45 && rsiValue >= 28 ? -12 : 0;
  score += price > Math.max(...completedHigh.slice(-20, -1)) ? 10 : price < Math.min(...completedLow.slice(-20, -1)) ? -10 : 0;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const action = score >= minimumScore ? "BUY_CALL" : score <= 100 - minimumScore ? "BUY_PUT" : "HOLD";
  return { action, score, price, ema20: fast, ema50: slow, rsi: rsiValue, momentum4BarsPct: momentum, atrPct, candleTimestamp: ticks.at(-2) ?? null, reason: action === "HOLD" ? "SIGNAL_BELOW_THRESHOLD" : "TREND_MOMENTUM_REGIME_ALIGNED" };
}

export function riskDecision({ signal, config, positions, openOrders, dailyTrades, now = Date.now(), lastTradeAt = 0 }) {
  if (signal.action === "HOLD") return { allowed: false, reason: signal.reason };
  if (positions > 0) return { allowed: false, reason: "MAX_OPEN_POSITIONS" };
  if (openOrders > 0) return { allowed: false, reason: "BOT_ORDER_ALREADY_OPEN" };
  if (dailyTrades >= config.maxDailyTrades) return { allowed: false, reason: "DAILY_TRADE_CAP" };
  if (now - lastTradeAt < config.cooldownMinutes * 60_000) return { allowed: false, reason: "COOLDOWN_ACTIVE" };
  return { allowed: true, reason: "RISK_CHECKS_PASSED" };
}
