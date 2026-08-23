import { NextRequest } from "next/server";
import { mt5BridgeFetch, mt5Unavailable } from "@/lib/mt5-bridge";

export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("days") ?? 30);
  const days = Number.isFinite(requested) ? Math.max(1, Math.min(Math.round(requested), 365)) : 30;
  try {
    const { response, payload } = await mt5BridgeFetch(`/snapshot?days=${days}`);
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return mt5Unavailable(error);
  }
}
