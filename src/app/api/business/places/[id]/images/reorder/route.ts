import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

/** Persist the order of existing PlaceImages for non-published places. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: placeId } = await params;
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { createdByUserId: true, ownerBusinessId: true, status: true },
  });
  if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  if (!(await canManagePlaceAsync(user, place))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (place.status === "PUBLISHED") {
    return NextResponse.json({ error: "Published images require revision" }, { status: 409 });
  }

  const payload = await req.json().catch(() => null) as {
    updates?: Array<{ id: string; sortOrder: number }>;
  } | null;
  const updates = payload?.updates;
  if (!Array.isArray(updates) || updates.length > 100 ||
      updates.some((item) => typeof item.id !== "string" ||
        !Number.isSafeInteger(item.sortOrder) || item.sortOrder < 0) ||
      new Set(updates.map((item) => item.id)).size !== updates.length) {
    return NextResponse.json({ error: "Invalid updates" }, { status: 400 });
  }
  const images = await prisma.placeImage.findMany({
    where: { placeId, kind: "GALLERY", id: { in: updates.map((item) => item.id) } },
    select: { id: true },
  });
  if (images.length !== updates.length) {
    return NextResponse.json({ error: "Images do not belong to this place" }, { status: 403 });
  }

  await prisma.$transaction(updates.map((item) =>
    prisma.placeImage.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
  ));
  return NextResponse.json({ success: true });
}
