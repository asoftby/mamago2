import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { MediaAssetKind, MediaAssetStatus } from "@prisma/client";

/**
 * Недавние изображения текущего пользователя — для выбора в визарде до первого сохранения события.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canCreateBusinessContent(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(60, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "36", 10)));

  const items = await prisma.mediaAsset.findMany({
    where: {
      kind: MediaAssetKind.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      publicUrl: { not: null },
      uploadedById: user.id,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      publicUrl: true,
      alt: true,
      title: true,
      sourceType: true,
    },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      publicUrl: i.publicUrl,
      alt: i.alt,
      title: i.title,
      sourceType: i.sourceType,
      fromEntity: false,
      showImportBadge: false,
    })),
  });
}
