import { NextResponse } from "next/server";

/**
 * @deprecated Use /api/bot/webhook instead.
 * This endpoint is no longer active.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This webhook endpoint has been removed. Use /api/bot/webhook." },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "This webhook endpoint has been removed. Use /api/bot/webhook." },
    { status: 410 },
  );
}
