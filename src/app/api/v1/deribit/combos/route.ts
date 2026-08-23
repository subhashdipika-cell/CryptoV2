import { NextRequest } from "next/server";
import { getInstrument, maxOptionAmount, privateCall, validateOptionInstrument } from "@/lib/deribit";
import { deribitFailure } from "@/lib/deribit-response";
import { comboOrderSchema, optionLabel } from "@/lib/deribit-schema";

export async function POST(request: NextRequest) {
  try {
    const parsed = comboOrderSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "INVALID_COMBO", issues: parsed.error.flatten() }, { status: 400 });
    const order = parsed.data;
    if (order.amount > maxOptionAmount()) return Response.json({ error: "INVALID_AMOUNT", message: `Amount may not exceed ${maxOptionAmount()}` }, { status: 400 });
    if (new Set(order.legs.map(leg => leg.instrumentName)).size !== order.legs.length) return Response.json({ error: "DUPLICATE_LEG" }, { status: 400 });
    const instruments = await Promise.all(order.legs.map(leg => getInstrument(leg.instrumentName)));
    instruments.forEach(instrument => validateOptionInstrument(instrument, order.currency));
    if (new Set(instruments.map(instrument => instrument.expiration_timestamp)).size !== 1) return Response.json({ error: "EXPIRY_MISMATCH" }, { status: 400 });
    if (order.amount < Math.max(...instruments.map(instrument => instrument.min_trade_amount))) return Response.json({ error: "AMOUNT_BELOW_MINIMUM" }, { status: 400 });
    const preview = { environment: "TESTNET", orderType: "limit", atomic: true, direction: order.direction, amount: order.amount, price: order.price, legs: order.legs, label: optionLabel(order.idempotencyKey) };
    if (order.action === "preview") return Response.json({ accepted: true, preview });
    if (!order.confirmTestnet) return Response.json({ error: "TESTNET_CONFIRMATION_REQUIRED" }, { status: 409 });
    const combo = await privateCall<{ id?: string; instrument_name?: string }>("private/create_combo", {
      trades: order.legs.map(leg => ({ instrument_name: leg.instrumentName, amount: leg.ratio, direction: leg.direction })),
    });
    const comboName = combo.id ?? combo.instrument_name;
    if (!comboName) throw new Error("Deribit did not return a combo instrument id");
    const result = await privateCall<Record<string, unknown>>(`private/${order.direction}`, {
      instrument_name: comboName, amount: order.amount, type: "limit", price: order.price,
      time_in_force: "good_til_cancelled", label: optionLabel(order.idempotencyKey),
    });
    return Response.json({ accepted: true, environment: "TESTNET", combo: comboName, result });
  } catch (error) { return deribitFailure(error); }
}
