import { NextRequest } from "next/server";
import { mt5BridgeFetch, mt5Unavailable } from "@/lib/mt5-bridge";

async function proxy(request: NextRequest, preview: boolean) {
  try {
    const body = await request.text();
    if (!body || body.length > 32_768) return Response.json({ error: "INVALID_BODY" }, { status: 400 });
    const { response, payload } = await mt5BridgeFetch(preview ? "/orders/preview" : "/orders", { method: "POST", body });
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return mt5Unavailable(error);
  }
}

export async function POST(request: NextRequest) {
  return proxy(request, request.nextUrl.searchParams.get("preview") === "true");
}
