import { NextRequest, NextResponse } from "next/server";
import { prismaBase } from "@/lib/prisma";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { purgeInbox } from "@/server/services/telegram/capture/inboxPurge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/inbox-purge
 * Scrubs stored message text and drafts after purgeAfter and deletes inbox items
 * older than 30 days (forward-to-plan spec v1.3, sections 11 and 13).
 * Idempotent; counts only in the response and logs.
 */
export async function GET(req: NextRequest) {
  const rejected = authorizeCronRequest(req.headers.get("authorization"));
  if (rejected) return rejected;

  try {
    const result = await purgeInbox({ db: prismaBase });
    return NextResponse.json({ success: true, ...result });
  } catch {
    console.error("[CRON] inbox-purge failed code=INBOX_PURGE_FAILED");
    return NextResponse.json({ error: "Inbox purge failed" }, { status: 500 });
  }
}
