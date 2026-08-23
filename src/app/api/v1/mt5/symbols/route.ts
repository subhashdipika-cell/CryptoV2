import { NextRequest } from "next/server";
import { mt5BridgeFetch, mt5Unavailable } from "@/lib/mt5-bridge";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const limit = request.nextUrl.searchParams.get("limit") ?? "100";
  try {
    const { response, payload } = await mt5BridgeFetch(`/symbols?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}`);
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return mt5Unavailable(error);
  }
}
