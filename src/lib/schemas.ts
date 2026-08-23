import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});

export const marketTickSchema = z.object({
  type: z.literal("tick"),
  exchange: z.enum(["binance", "bybit", "okx", "deribit", "simulation"]),
  symbol: z.string().min(3),
  price: z.number().positive(),
  size: z.number().nonnegative(),
  side: z.enum(["buy", "sell"]),
  ts: z.number().int().positive(),
  sequence: z.number().int().nonnegative(),
});

export const paperOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  executionMode: z.literal("PAPER"),
  exchange: z.enum(["binance", "bybit", "okx"]),
  symbol: z.string().regex(/^[A-Z0-9]{3,20}$/),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT"]),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  leverage: z.number().int().min(1).max(10),
  takeProfit: z.number().positive().optional(),
  stopLoss: z.number().positive(),
  reduceOnly: z.boolean().default(false),
}).superRefine((order, context) => {
  if (order.type === "LIMIT" && !order.limitPrice) context.addIssue({ code: "custom", message: "Limit price is required", path: ["limitPrice"] });
});

export const screenerRequestSchema = z.object({
  logic: z.enum(["AND", "OR"]),
  conditions: z.array(z.object({
    field: z.enum(["rsi", "funding", "volume", "oiChange", "change"]),
    operator: z.enum([">", "<", ">=", "<=", "="]),
    value: z.number(),
  })).min(1).max(12),
});

export type MarketTick = z.infer<typeof marketTickSchema>;
export type PaperOrder = z.infer<typeof paperOrderSchema>;
