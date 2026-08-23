import { NextResponse } from "next/server";
import { markets } from "@/lib/mock-data";
import { scoreMarket } from "@/lib/scoring";

export async function GET() {
  return NextResponse.json({
    data: markets.map((market) => ({ ...market, intelligence: scoreMarket(market) })),
    meta: { mode: "SIMULATION", tracked: 824, asOf: new Date().toISOString() },
  });
}
