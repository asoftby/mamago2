/**
 * GET /api/cron/cleanup-temp-media
 * Cleanup abandoned TEMP media assets
 *
 * Should be called by a cron job (e.g., daily)
 * Deletes TEMP media older than 24 hours (configurable)
 */

import { NextRequest, NextResponse } from "next/server";
import { cleanupAbandonedTempMedia } from "@/server/services/media/media.service";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production") {
      if (!cronSecret?.trim()) {
        return NextResponse.json(
          { error: "Cron not configured" },
          { status: 503 },
        );
      }
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      if (cronSecret?.trim() && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Get hours parameter from query (default: 24)
    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get("hours") || "24", 10);

    if (process.env.NODE_ENV !== "production") {
      console.info(`[CRON] TEMP media cleanup starting (older than ${hours}h)`);
    }

    const result = await cleanupAbandonedTempMedia(hours);

    if (process.env.NODE_ENV !== "production") {
      console.info("[CRON] TEMP media cleanup complete", {
        found: result.found,
        deleted: result.deleted,
      });
    }

    return NextResponse.json({
      success: true,
      found: result.found,
      deleted: result.deleted,
      hours,
    });
  } catch (error) {
    console.error("[CRON] TEMP media cleanup error");
    if (error instanceof Error) {
      console.error(error.message);
    }
    return NextResponse.json(
      {
        error: "Cleanup failed",
      },
      { status: 500 },
    );
  }
}
