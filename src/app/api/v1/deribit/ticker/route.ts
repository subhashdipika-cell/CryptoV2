import { NextRequest } from "next/server";
import { getTicker } from "@/lib/deribit";
import { deribitFailure } from "@/lib/deribit-response";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("instrumentName") ?? "";
  if (!/^(BTC|ETH)-[A-Z0-9-]+$/.test(name)) return Response.json({ error: "INVALID_INSTRUMENT" }, { status: 400 });
  try { return Response.json({ environment: "TESTNET", ticker: await getTicker(name), updatedAt: Date.now() }); }
  catch (error) { return deribitFailure(error); }
}
