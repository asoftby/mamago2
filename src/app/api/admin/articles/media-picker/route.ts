import { NextRequest, NextResponse } from "next/server";
import { MediaAssetKind, MediaAssetStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";

export const runtime = "nodejs";

/**
 * Недавние изображения для выбора обложки статьи (без полного UI медиатеки).
 */
export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(60, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "36", 10)));

  const items = await prisma.mediaAsset.findMany({
    where: {
      kind: MediaAssetKind.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      publicUrl: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      publicUrl: true,
      alt: true,
      title: true,
    },
  });

  return NextResponse.json({ items });
}
