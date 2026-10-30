import { NextRequest, NextResponse } from "next/server";

import { authorizeCronRequest } from "@/server/cron/authorizeCron";
import { archiveExpiredWishlists } from "@/server/wishlist/wishlist.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/wishlist-archive
 * Archives active wishlists whose event date passed more than 7 days ago.
 * Idempotent; no-op while WISHLIST_ENABLED is off.
 */
export async function GET(req: NextRequest) {
  const rejected = authorizeCronRequest(req.headers.get("authorization"));
  if (rejected) return rejected;
  try {
    return NextResponse.json({ success: true, ...(await archiveExpiredWishlists()) });
  } catch {
    console.error("[CRON] wishlist-archive failed code=WISHLIST_ARCHIVE_FAILED");
    return NextResponse.json({ error: "Wishlist archive failed" }, { status: 500 });
  }
}
