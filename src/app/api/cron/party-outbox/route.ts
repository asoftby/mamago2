import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { dispatchPartyOutbox } from "@/server/birthday/partyOutbox.service";
import { expirePartyRequests } from "@/server/birthday/partyRequestExpiry.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rejected = authorizeCronRequest(request.headers.get("authorization"));
  if (rejected) return rejected;
  try {
    const expired = await expirePartyRequests();
    const result = await dispatchPartyOutbox();
    return NextResponse.json({ ok: true, expired, ...result }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error("[party-outbox] cron failed");
    return NextResponse.json({ error: "Party outbox failed" }, { status: 500 });
  }
}
