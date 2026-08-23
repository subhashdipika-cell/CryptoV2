import { NextRequest } from "next/server";
import { mt5BridgeFetch, mt5Unavailable } from "@/lib/mt5-bridge";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  try {
    const { response, payload } = await mt5BridgeFetch(`/tick?symbol=${encodeURIComponent(symbol)}`);
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return mt5Unavailable(error);
  }
}
