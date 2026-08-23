import { NextRequest, NextResponse } from "next/server";
import { paperOrderSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const parsed = paperOrderSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_ORDER", issues: parsed.error.flatten() }, { status: 422 });
  return NextResponse.json({
    data: {
      orderId: crypto.randomUUID(),
      status: "SIMULATED_ACCEPTED",
      executionMode: "PAPER",
      receivedAt: new Date().toISOString(),
      order: parsed.data,
    },
  }, { status: 202 });
}
