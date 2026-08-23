export interface MT5Connection {
  status: "connected" | "disconnected";
  bridge: { uptimeSeconds: number; version: string };
  terminal: { connected: boolean; tradeAllowed: boolean; build: number; company: string };
  account: {
    loginMasked: string;
    server: string;
    company: string;
    tradeMode: number;
    mode: "DEMO" | "REAL_OR_CONTEST";
    tradeAllowed: boolean;
    expertAllowed: boolean;
  };
  safety: {
    demoVerified: boolean;
    demoOrderRoutingEnabled: boolean;
    realOrderRoutingAvailable: false;
  };
  asOf: string;
}

export interface MT5Account {
  currency: string;
  balance: number;
  equity: number;
  profit: number;
  credit: number;
  margin: number;
  marginFree: number;
  marginLevel: number | null;
  leverage: number;
}

export interface MT5Position {
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  swap: number;
  magic: number;
  comment: string;
  openedAt: string;
}

export interface MT5Snapshot {
  connection: MT5Connection;
  account: MT5Account;
  positions: MT5Position[];
  orders: Array<Record<string, unknown>>;
  equityCurve: Array<{ time: string; equity: number }>;
  asOf: string;
}

export interface MT5ApiEnvelope<T> {
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}
