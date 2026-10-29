import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { dispatchPartyOutbox } from "@/server/birthday/partyOutbox.service";
import { expirePartyRequests } from "@/server/birthday/partyRequestExpiry.service";
import { replenishPartyCandidateWaves } from "@/server/birthday/partyCandidateReplenishment.service";
import { getPartyDeliveryHealth, reconcileStalePartyDeliveries } from "@/server/birthday/partyDeliveryHealth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rejected = authorizeCronRequest(request.headers.get("authorization"));
  if (rejected) return rejected;
  try {
    const expired = await expirePartyRequests();
    const replenishment = await replenishPartyCandidateWaves();
    const result = await dispatchPartyOutbox();
    // Counts only, no identities, messages, or delivery errors. A successful
    // outbox dispatch does not imply that external channels succeeded.
    const reconciliation = await reconcileStalePartyDeliveries();
    const deliveryHealth = await getPartyDeliveryHealth();
    if (deliveryHealth.requiresAttention) {
      console.error("[party-outbox] Delivery reconciliation required", deliveryHealth);
    }
    return NextResponse.json({ ok: true, expired, replenishment, ...result, reconciliation, deliveryHealth }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error("[party-outbox] cron failed");
    return NextResponse.json({ error: "Party outbox failed" }, { status: 500 });
  }
}
