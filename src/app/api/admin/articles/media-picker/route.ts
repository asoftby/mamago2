import { NextRequest, NextResponse } from "next/server";
import { MediaAssetKind, MediaAssetStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { parsePaginationParams } from "@/lib/api/pagination";

export const runtime = "nodejs";

/**
 * Недавние изображения для выбора обложки статьи (без полного UI медиатеки).
 */
export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { limit } = parsePaginationParams(req.nextUrl.searchParams, {
    defaultLimit: 36,
    maxLimit: 60,
  });

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
