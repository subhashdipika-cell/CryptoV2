import "server-only";

import type { DeribitCurrency } from "./deribit-schema";

const TESTNET_BASE = "https://test.deribit.com/api/v2";
const TIMEOUT_MS = 10_000;

type RpcEnvelope<T> = { result?: T; error?: { code: number; message: string; data?: unknown } };
export type DeribitInstrument = {
  instrument_name: string;
  base_currency: string;
  kind: "option" | string;
  state: string;
  option_type?: "call" | "put";
  strike?: number;
  expiration_timestamp: number;
  tick_size: number;
  min_trade_amount: number;
};
type BookSummary = {
  instrument_name: string;
  bid_price: number | null;
  ask_price: number | null;
  mark_price: number | null;
  mark_iv?: number | null;
  open_interest?: number | null;
  volume?: number | null;
  underlying_price?: number | null;
};

let tokenCache: { token: string; expiresAt: number; scope: string } | null = null;
const chainCache = new Map<string, { expiresAt: number; value: unknown }>();

export class DeribitError extends Error {
  constructor(message: string, readonly code = 502, readonly details?: unknown) { super(message); }
}

async function rpc<T>(method: string, params: Record<string, string | number | boolean>, token?: string): Promise<T> {
  const url = new URL(`${TESTNET_BASE}/${method}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await response.json() as RpcEnvelope<T>;
  if (!response.ok || body.error) throw new DeribitError(body.error?.message ?? `Deribit HTTP ${response.status}`, 502, body.error);
  if (body.result === undefined) throw new DeribitError("Deribit returned no result");
  return body.result;
}

export function deribitConfigured() {
  return Boolean(process.env.DERIBIT_TESTNET_CLIENT_ID && process.env.DERIBIT_TESTNET_CLIENT_SECRET);
}

async function accessToken() {
  if (!deribitConfigured()) throw new DeribitError("Deribit Testnet credentials are not configured", 503);
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache;
  const auth = await rpc<{ access_token: string; expires_in: number; scope: string }>("public/auth", {
    grant_type: "client_credentials",
    client_id: process.env.DERIBIT_TESTNET_CLIENT_ID!,
    client_secret: process.env.DERIBIT_TESTNET_CLIENT_SECRET!,
  });
  tokenCache = { token: auth.access_token, expiresAt: Date.now() + auth.expires_in * 1000, scope: auth.scope };
  return tokenCache;
}

export async function getOptionChain(currency: DeribitCurrency) {
  const cached = chainCache.get(currency);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const [instruments, summaries] = await Promise.all([
    rpc<DeribitInstrument[]>("public/get_instruments", { currency, kind: "option", expired: false }),
    rpc<BookSummary[]>("public/get_book_summary_by_currency", { currency, kind: "option" }),
  ]);
  const summaryByName = new Map(summaries.map(item => [item.instrument_name, item]));
  const options = instruments.map(instrument => ({
    instrumentName: instrument.instrument_name,
    expirationTimestamp: instrument.expiration_timestamp,
    strike: instrument.strike ?? 0,
    optionType: instrument.option_type,
    tickSize: instrument.tick_size,
    minTradeAmount: instrument.min_trade_amount,
    ...summaryByName.get(instrument.instrument_name),
  })).filter(item => item.optionType && item.strike > 0);
  const expiries = [...new Set(options.map(item => item.expirationTimestamp))].sort((a, b) => a - b);
  const underlyingPrice = options.find(item => item.underlying_price)?.underlying_price ?? null;
  const value = { environment: "TESTNET" as const, currency, underlyingPrice, expiries, options, updatedAt: Date.now() };
  chainCache.set(currency, { value, expiresAt: Date.now() + 30_000 });
  return value;
}

export async function getTicker(instrumentName: string) {
  return rpc<Record<string, unknown>>("public/ticker", { instrument_name: instrumentName });
}

export async function getInstrument(instrumentName: string) {
  return rpc<DeribitInstrument>("public/get_instrument", { instrument_name: instrumentName });
}

export async function getPrivateSnapshot(currency: DeribitCurrency) {
  const auth = await accessToken();
  const [account, positions, openOrders] = await Promise.all([
    rpc<Record<string, unknown>>("private/get_account_summary", { currency, extended: true }, auth.token),
    rpc<unknown[]>("private/get_positions", { currency, kind: "option" }, auth.token),
    rpc<unknown[]>("private/get_open_orders_by_currency", { currency, kind: "option" }, auth.token),
  ]);
  return { environment: "TESTNET" as const, scope: auth.scope, account, positions, openOrders, updatedAt: Date.now() };
}

export async function privateCall<T>(method: string, params: Record<string, string | number | boolean | object[]>) {
  const auth = await accessToken();
  return rpc<T>(method, params as Record<string, string | number | boolean>, auth.token);
}

export function validateOptionInstrument(instrument: DeribitInstrument, currency: DeribitCurrency) {
  if (instrument.kind !== "option" || instrument.state !== "open" || instrument.base_currency !== currency) {
    throw new DeribitError("Instrument is not an open option for the selected currency", 400);
  }
}

export function maxOptionAmount() {
  const configured = Number(process.env.DERIBIT_TESTNET_MAX_OPTION_AMOUNT ?? "10");
  return Number.isFinite(configured) && configured > 0 ? configured : 10;
}
