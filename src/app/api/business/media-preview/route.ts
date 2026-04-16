import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { MediaAssetKind, MediaAssetStatus } from "@prisma/client";

/**
 * GET /api/business/media-preview?id=mediaAssetId
 * Публичный URL превью для бизнес-редактора (события и т.д.).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canCreateBusinessContent(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id,
      kind: MediaAssetKind.IMAGE,
      status: MediaAssetStatus.ACTIVE,
    },
    select: { id: true, publicUrl: true, alt: true, filename: true },
  });

  if (!asset?.publicUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: asset.id,
    publicUrl: asset.publicUrl,
    alt: asset.alt,
    filename: asset.filename,
  });
}
