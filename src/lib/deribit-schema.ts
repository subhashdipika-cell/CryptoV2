import { z } from "zod";

export const deribitCurrencySchema = z.enum(["BTC", "ETH"]);
export type DeribitCurrency = z.infer<typeof deribitCurrencySchema>;

const instrumentName = z.string().regex(/^(BTC|ETH)-[A-Z0-9-]+$/, "Invalid Deribit instrument");

export const optionOrderSchema = z.object({
  action: z.enum(["preview", "submit"]),
  currency: deribitCurrencySchema,
  instrumentName,
  direction: z.enum(["buy", "sell"]),
  amount: z.number().positive().finite(),
  price: z.number().positive().finite(),
  idempotencyKey: z.string().uuid(),
  confirmTestnet: z.boolean().default(false),
}).strict();

export const comboOrderSchema = z.object({
  action: z.enum(["preview", "submit"]),
  currency: deribitCurrencySchema,
  direction: z.enum(["buy", "sell"]),
  amount: z.number().positive().finite(),
  price: z.number().finite(),
  idempotencyKey: z.string().uuid(),
  confirmTestnet: z.boolean().default(false),
  legs: z.array(z.object({
    instrumentName,
    direction: z.enum(["buy", "sell"]),
    ratio: z.number().int().min(1).max(10),
  }).strict()).min(2).max(4),
}).strict();

export function optionLabel(idempotencyKey: string) {
  return `CV2-${idempotencyKey}`.slice(0, 64);
}
