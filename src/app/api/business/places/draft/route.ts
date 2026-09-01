/** GET /api/business/places/draft */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";

const STALE_DRAFT_HOURS = 24;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Business content access required" },
        { status: 403 },
      );
    }

    const existingDraft = await prisma.place.findFirst({
      where: { createdByUserId: user.id, status: ContentStatus.DRAFT },
      select: {
        id: true,
        title: true,
        lat: true,
        lng: true,
        createdAt: true,
        images: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!existingDraft) return NextResponse.json({ draft: null });

    if (isStaleEmptyDraft(existingDraft)) {
      await prisma.place.delete({ where: { id: existingDraft.id } });
      return NextResponse.json({ draft: null });
    }

    return NextResponse.json({
      draft: { id: existingDraft.id, title: existingDraft.title },
    });
  } catch (error) {
    console.error("[draft] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      { status: 500 },
    );
  }
}

function isStaleEmptyDraft(draft: {
  title: string;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
  images: Array<{ id: string }>;
}): boolean {
  const ageHours = (Date.now() - draft.createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < STALE_DRAFT_HOURS) return false;
  if (draft.lat !== null && draft.lng !== null) return false;
  if (draft.images.length > 0) return false;

  return !(
    draft.title &&
    draft.title !== "Новое место" &&
    draft.title.trim().length > 0
  );
}
