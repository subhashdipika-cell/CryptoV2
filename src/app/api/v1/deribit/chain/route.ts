import { NextRequest } from "next/server";
import { getOptionChain } from "@/lib/deribit";
import { deribitCurrencySchema } from "@/lib/deribit-schema";
import { deribitFailure } from "@/lib/deribit-response";

export async function GET(request: NextRequest) {
  const currency = deribitCurrencySchema.safeParse(request.nextUrl.searchParams.get("currency") ?? "BTC");
  if (!currency.success) return Response.json({ error: "INVALID_CURRENCY" }, { status: 400 });
  try { return Response.json(await getOptionChain(currency.data)); }
  catch (error) { return deribitFailure(error); }
}
