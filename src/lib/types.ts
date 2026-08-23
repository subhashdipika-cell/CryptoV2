export type Timeframe = "1H" | "4H" | "24H" | "7D" | "30D";

export interface Market {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  funding: number;
  oiChange: number;
  rsi: number;
  color: string;
}

export interface PatternSignal {
  id: string;
  symbol: string;
  pattern: string;
  timeframe: string;
  direction: "bullish" | "bearish";
  progress: number;
  target: number;
  stop: number;
  rr: number;
  age: string;
}

export type ScreenerOperator = ">" | "<" | ">=" | "<=" | "=";

export interface ScreenerCondition {
  field: keyof Pick<Market, "rsi" | "funding" | "volume" | "oiChange" | "change">;
  operator: ScreenerOperator;
  value: number;
}
