/**
 * POST /api/admin/media/bulk-delete — удаление нескольких неиспользуемых файлов.
 * Тело: { ids: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { bulkHardDeleteUnusedMediaAssets } from "@/server/services/media/media.service";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const raw = body?.ids;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
    }

    const ids = raw.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids is empty" }, { status: 400 });
    }

    const result = await bulkHardDeleteUnusedMediaAssets(ids);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Bulk delete media error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to bulk delete media" },
      { status: 500 }
    );
  }
}
