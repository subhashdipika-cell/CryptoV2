import { deribitConfigured, getPrivateSnapshot } from "@/lib/deribit";
import { deribitFailure } from "@/lib/deribit-response";

export async function GET() {
  if (!deribitConfigured()) return Response.json({ environment: "TESTNET", configured: false, authenticated: false, orderRouting: false });
  try {
    const snapshot = await getPrivateSnapshot("BTC");
    return Response.json({ environment: "TESTNET", configured: true, authenticated: true, orderRouting: snapshot.scope.includes("trade:read_write"), scope: snapshot.scope });
  } catch (error) { return deribitFailure(error); }
}
