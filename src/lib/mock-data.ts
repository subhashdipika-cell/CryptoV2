import type { Market, PatternSignal } from "./types";

export const markets: Market[] = [
  { symbol: "BTC", name: "Bitcoin", price: 114382.4, change: 2.48, volume: 48.2e9, funding: 0.0082, oiChange: 4.8, rsi: 62, color: "#f6b94a" },
  { symbol: "ETH", name: "Ethereum", price: 3641.82, change: 4.86, volume: 31.4e9, funding: 0.0114, oiChange: 7.2, rsi: 68, color: "#8197ff" },
  { symbol: "SOL", name: "Solana", price: 176.44, change: 7.23, volume: 8.9e9, funding: 0.0189, oiChange: 12.4, rsi: 74, color: "#9a7bff" },
  { symbol: "XRP", name: "XRP", price: 3.07, change: -1.62, volume: 6.1e9, funding: -0.0021, oiChange: -3.1, rsi: 44, color: "#5de1e6" },
  { symbol: "DOGE", name: "Dogecoin", price: 0.2241, change: 3.92, volume: 3.7e9, funding: 0.0142, oiChange: 6.9, rsi: 65, color: "#d9b94e" },
  { symbol: "BNB", name: "BNB", price: 769.31, change: 1.44, volume: 2.2e9, funding: 0.0038, oiChange: 2.2, rsi: 57, color: "#f3ba2f" },
  { symbol: "ADA", name: "Cardano", price: 0.783, change: -3.18, volume: 1.3e9, funding: -0.009, oiChange: -5.4, rsi: 39, color: "#4a79e8" },
  { symbol: "LINK", name: "Chainlink", price: 18.71, change: 5.34, volume: 1.8e9, funding: 0.0066, oiChange: 8.6, rsi: 69, color: "#4974f5" },
  { symbol: "AVAX", name: "Avalanche", price: 24.82, change: -2.54, volume: 824e6, funding: -0.0042, oiChange: -2.8, rsi: 41, color: "#e84142" },
  { symbol: "SUI", name: "Sui", price: 3.61, change: 9.78, volume: 1.9e9, funding: 0.021, oiChange: 17.3, rsi: 78, color: "#6fbcf0" },
  { symbol: "PEPE", name: "Pepe", price: 0.000012, change: -5.72, volume: 968e6, funding: -0.014, oiChange: -9.2, rsi: 33, color: "#65bd72" },
  { symbol: "HYPE", name: "Hyperliquid", price: 44.19, change: 6.12, volume: 562e6, funding: 0.009, oiChange: 11.1, rsi: 71, color: "#5ce9c1" },
];

export const patterns: PatternSignal[] = [
  { id: "p1", symbol: "SOL", pattern: "Bull Flag", timeframe: "1H", direction: "bullish", progress: 86, target: 194.2, stop: 168.1, rr: 2.8, age: "3h ago" },
  { id: "p2", symbol: "ETH", pattern: "Ascending Triangle", timeframe: "4H", direction: "bullish", progress: 72, target: 3890, stop: 3494, rr: 2.4, age: "7h ago" },
  { id: "p3", symbol: "AVAX", pattern: "Falling Wedge", timeframe: "1D", direction: "bullish", progress: 64, target: 29.1, stop: 22.9, rr: 2.1, age: "1d ago" },
  { id: "p4", symbol: "PEPE", pattern: "Demand Breach", timeframe: "15M", direction: "bearish", progress: 91, target: 0.0000102, stop: 0.0000128, rr: 3.2, age: "18m ago" },
];

export const sparkline = [34, 38, 36, 43, 41, 48, 52, 49, 58, 62, 59, 67, 71, 69, 76, 81, 78, 86, 91, 88, 96];

export const optionStrikes = [
  { strike: 100000, callOi: 1280, putOi: 3220, iv: 61 },
  { strike: 105000, callOi: 1890, putOi: 2860, iv: 58 },
  { strike: 110000, callOi: 3120, putOi: 2410, iv: 54 },
  { strike: 115000, callOi: 4890, putOi: 4370, iv: 52 },
  { strike: 120000, callOi: 5820, putOi: 1980, iv: 55 },
  { strike: 125000, callOi: 3740, putOi: 910, iv: 59 },
  { strike: 130000, callOi: 2210, putOi: 480, iv: 64 },
];
