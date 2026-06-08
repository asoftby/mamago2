import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { buildMediaFilePublicUrl, extractMediaRelativePathFromUrl } from "@/server/media/media-storage";

export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      publicUrl: true,
      storageKey: true,
      alt: true,
      filename: true,
      mimeType: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fallbackPublicUrl =
    asset.publicUrl?.trim() ||
    (asset.storageKey?.trim()
      ? asset.storageKey.trim().startsWith("/api/media/file/")
        ? asset.storageKey.trim()
        : (() => {
            const relativePath = extractMediaRelativePathFromUrl(asset.storageKey);
            return relativePath ? buildMediaFilePublicUrl(relativePath) : null;
          })()
      : null) ||
    (asset.filename?.trim() ? buildMediaFilePublicUrl(asset.filename.trim()) : null);

  return NextResponse.json({
    ...asset,
    publicUrl: fallbackPublicUrl,
  });
}
