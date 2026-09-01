import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";
import prisma from "@/lib/prisma";
import { MediaAssetKind, MediaAssetStatus } from "@prisma/client";

/** GET /api/business/media-preview?id=mediaAssetId */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!(await checkBusinessToolPermission(user, "content.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const asset = await prisma.mediaAsset.findFirst({
    where: { id, kind: MediaAssetKind.IMAGE, status: MediaAssetStatus.ACTIVE },
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
