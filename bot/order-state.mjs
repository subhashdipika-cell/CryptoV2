export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isAmbiguousTransportError(error) {
  return /abort|timeout|fetch|network|socket|connection/i.test(errorMessage(error));
}

export function filledAmount(result) {
  const trades = Array.isArray(result?.trades) ? result.trades : [];
  const fromTrades = trades.reduce((sum, item) => sum + Math.abs(Number(item.amount ?? 0)), 0);
  return Math.max(fromTrades, Math.abs(Number(result?.order?.filled_amount ?? 0)));
}

export function findActivePosition(positions, instrumentName) {
  return (positions ?? []).find(item => item.instrument_name === instrumentName && Math.abs(Number(item.size ?? 0)) > 0) ?? null;
}
