import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { backfillActivityMediaIdsFromUrls } from "@/server/services/media/media-usage.service";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await backfillActivityMediaIdsFromUrls();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error backfilling activity media links:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to backfill activity media links",
      },
      { status: 500 },
    );
  }
}
