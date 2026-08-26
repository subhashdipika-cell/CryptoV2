export type BotTrade = {
  trade_id: string;
  order_id?: string;
  timestamp: number;
  label?: string;
  profit_loss?: number;
  fee?: number;
  fee_currency?: string;
  index_price?: number;
};

export type BotPositionPnl = { floatingPnlUsd: number };

export type PnlPeriod = {
  totalUsd: number;
  realizedUsd: number;
  unrealizedUsd: number;
  tradeCount: number;
};

function tradeNetUsd(trade: BotTrade) {
  const indexPrice = Number(trade.index_price ?? 0);
  const realizedBase = Number(trade.profit_loss ?? 0);
  const fee = Number(trade.fee ?? 0);
  const baseValueUsd = realizedBase * indexPrice;
  const feeUsd = ["USDC", "USDT", "EURR"].includes(String(trade.fee_currency)) ? fee : fee * indexPrice;
  return baseValueUsd - feeUsd;
}

function period(trades: BotTrade[], positions: BotPositionPnl[], start: number) {
  const selected = trades.filter(trade => trade.timestamp >= start);
  const realizedUsd = selected.reduce((sum, trade) => sum + tradeNetUsd(trade), 0);
  const unrealizedUsd = positions.reduce((sum, position) => sum + position.floatingPnlUsd, 0);
  const closedOrders = new Set(selected.filter(trade => String(trade.label).startsWith("CV2-AI-EXIT-")).map(trade => trade.order_id ?? trade.trade_id));
  return { totalUsd: realizedUsd + unrealizedUsd, realizedUsd, unrealizedUsd, tradeCount: closedOrders.size } satisfies PnlPeriod;
}

export function calculateBotPerformance(trades: BotTrade[], positions: BotPositionPnl[], now = Date.now()) {
  const instant = new Date(now);
  const dayStart = Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
  const monthStart = Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), 1);
  const uniqueTrades = [...trades.filter(trade => String(trade.label).startsWith("CV2-AI-")).reduce((seen, trade) => {
    if (!seen.has(trade.trade_id)) seen.set(trade.trade_id, trade);
    return seen;
  }, new Map<string, BotTrade>()).values()];
  return {
    daily: period(uniqueTrades, positions, dayStart),
    monthly: period(uniqueTrades, positions, monthStart),
    overall: period(uniqueTrades, positions, 0),
  };
}
