import { NextRequest } from "next/server";
import { mt5BridgeFetch, mt5Unavailable } from "@/lib/mt5-bridge";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "BTCUSD";
  const timeframe = request.nextUrl.searchParams.get("timeframe") ?? "H1";
  const count = request.nextUrl.searchParams.get("count") ?? "300";
  try {
    const { response, payload } = await mt5BridgeFetch(`/rates?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&count=${encodeURIComponent(count)}`);
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return mt5Unavailable(error);
  }
}
