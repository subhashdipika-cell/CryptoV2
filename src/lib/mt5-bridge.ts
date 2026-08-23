import "server-only";

const bridgeUrl = process.env.MT5_BRIDGE_URL ?? "http://127.0.0.1:8765";

export async function mt5BridgeFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${bridgeUrl}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json();
  return { response, payload };
}

export function mt5Unavailable(error: unknown) {
  return Response.json({
    error: "MT5_BRIDGE_UNAVAILABLE",
    message: error instanceof Error ? error.message : "The local MT5 bridge is unavailable",
  }, { status: 503 });
}
