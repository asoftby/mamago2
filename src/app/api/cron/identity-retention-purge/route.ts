import { NextRequest, NextResponse } from "next/server";
import { prismaBase } from "@/lib/prisma";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { purgeExpiredIdentityRecords } from "@/server/privacy/identityRetention/purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/identity-retention-purge
 * Removes IdentityRetentionRecord rows one year after account deletion
 * (постановление Совмина РБ № 850). Idempotent; counts only in the response and logs.
 */
export async function GET(req: NextRequest) {
  const rejected = authorizeCronRequest(req.headers.get("authorization"));
  if (rejected) return rejected;

  try {
    const result = await purgeExpiredIdentityRecords({ db: prismaBase });
    console.info(`[CRON] identity-retention-purge deleted=${result.deleted}`);
    return NextResponse.json({ success: true, ...result });
  } catch {
    console.error("[CRON] identity-retention-purge failed code=IDENTITY_RETENTION_PURGE_FAILED");
    return NextResponse.json({ error: "Identity retention purge failed" }, { status: 500 });
  }
}
