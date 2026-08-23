import { DeribitError } from "./deribit";

export function deribitFailure(error: unknown) {
  if (error instanceof DeribitError) return Response.json({ error: "DERIBIT_ERROR", message: error.message, details: error.details }, { status: error.code });
  return Response.json({ error: "DERIBIT_UNAVAILABLE", message: error instanceof Error ? error.message : "Deribit Testnet is unavailable" }, { status: 502 });
}
