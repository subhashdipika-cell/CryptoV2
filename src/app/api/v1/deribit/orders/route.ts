import { NextRequest } from "next/server";
import { getInstrument, maxOptionAmount, privateCall, validateOptionInstrument } from "@/lib/deribit";
import { deribitFailure } from "@/lib/deribit-response";
import { optionLabel, optionOrderSchema } from "@/lib/deribit-schema";

export async function POST(request: NextRequest) {
  try {
    const parsed = optionOrderSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "INVALID_ORDER", issues: parsed.error.flatten() }, { status: 400 });
    const order = parsed.data;
    const instrument = await getInstrument(order.instrumentName);
    validateOptionInstrument(instrument, order.currency);
    if (order.amount < instrument.min_trade_amount || order.amount > maxOptionAmount()) {
      return Response.json({ error: "INVALID_AMOUNT", message: `Amount must be between ${instrument.min_trade_amount} and ${maxOptionAmount()}` }, { status: 400 });
    }
    const ticks = order.price / instrument.tick_size;
    if (Math.abs(ticks - Math.round(ticks)) > 1e-8) return Response.json({ error: "INVALID_PRICE_TICK", tickSize: instrument.tick_size }, { status: 400 });
    const preview = { environment: "TESTNET", orderType: "limit", timeInForce: "good_til_cancelled", instrument: order.instrumentName, direction: order.direction, amount: order.amount, price: order.price, label: optionLabel(order.idempotencyKey) };
    if (order.action === "preview") return Response.json({ accepted: true, preview });
    if (!order.confirmTestnet) return Response.json({ error: "TESTNET_CONFIRMATION_REQUIRED" }, { status: 409 });
    const result = await privateCall<Record<string, unknown>>(`private/${order.direction}`, {
      instrument_name: order.instrumentName, amount: order.amount, type: "limit", price: order.price,
      time_in_force: "good_til_cancelled", label: optionLabel(order.idempotencyKey),
    });
    return Response.json({ accepted: true, environment: "TESTNET", result });
  } catch (error) { return deribitFailure(error); }
}
