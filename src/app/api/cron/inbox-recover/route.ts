import { NextRequest, NextResponse } from "next/server";
import { prismaBase } from "@/lib/prisma";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { createDefaultCaptureProcessor } from "@/server/services/telegram/capture/captureWiring";
import { recoverInbox } from "@/server/services/telegram/capture/inboxRecover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/inbox-recover
 * Re-runs the capture processor for InboxItems stuck in RECEIVED/PROCESSING
 * (forward-to-plan spec v1.3, section 11). Counts only in the response and logs.
 */
export async function GET(req: NextRequest) {
  const rejected = authorizeCronRequest(req.headers.get("authorization"));
  if (rejected) return rejected;

  try {
    const result = await recoverInbox({ db: prismaBase, processor: createDefaultCaptureProcessor() });
    return NextResponse.json({ success: true, ...result });
  } catch {
    console.error("[CRON] inbox-recover failed code=INBOX_RECOVER_FAILED");
    return NextResponse.json({ error: "Inbox recover failed" }, { status: 500 });
  }
}
