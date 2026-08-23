import { mt5BridgeFetch, mt5Unavailable } from "@/lib/mt5-bridge";

export async function GET() {
  try {
    const { response, payload } = await mt5BridgeFetch("/health");
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return mt5Unavailable(error);
  }
}
