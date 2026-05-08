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
    // Verify cron secret (optional but recommended)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get hours parameter from query (default: 24)
    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get("hours") || "24", 10);

    console.log(`🧹 [CRON] Starting TEMP media cleanup (older than ${hours}h)`);

    const result = await cleanupAbandonedTempMedia(hours);

    console.log(`✅ [CRON] TEMP media cleanup complete:`, result);

    return NextResponse.json({
      success: true,
      found: result.found,
      deleted: result.deleted,
      hours,
    });
  } catch (error) {
    console.error("❌ [CRON] TEMP media cleanup error:", error);
    return NextResponse.json(
      { 
        error: "Cleanup failed", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
