import { NextRequest, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";

export type EntityPreviewPayload = {
  entityType: "EVENT" | "PLACE" | "OFFER";
  title: string;
  city: string | null;
};

export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type") as "EVENT" | "PLACE" | "OFFER" | null;

  if (!id || !type || !["EVENT", "PLACE", "OFFER"].includes(type)) {
    return NextResponse.json({ error: "id and type (EVENT|PLACE|OFFER) required" }, { status: 400 });
  }

  try {
    if (type === "PLACE") {
      const p = await prisma.place.findUnique({
        where: { id },
        select: { title: true, city: { select: { name: true } } },
      });
      if (!p) return NextResponse.json({ preview: null });
      const payload: EntityPreviewPayload = {
        entityType: "PLACE",
        title: p.title,
        city: p.city?.name ?? null,
      };
      return NextResponse.json({ preview: payload });
    }

    if (type === "EVENT") {
      const a = await prisma.activity.findUnique({
        where: { id },
        select: {
          title: true,
          type: true,
          place: { select: { city: { select: { name: true } } } },
        },
      });
      if (!a || a.type !== ActivityType.EVENT) return NextResponse.json({ preview: null });
      const payload: EntityPreviewPayload = {
        entityType: "EVENT",
        title: a.title,
        city: a.place?.city?.name ?? null,
      };
      return NextResponse.json({ preview: payload });
    }

    const o = await prisma.offer.findUnique({
      where: { id },
      select: { title: true, place: { select: { city: { select: { name: true } } } } },
    });
    if (!o) return NextResponse.json({ preview: null });
    const payload: EntityPreviewPayload = {
      entityType: "OFFER",
      title: o.title,
      city: o.place?.city?.name ?? null,
    };
    return NextResponse.json({ preview: payload });
  } catch (e) {
    console.error("[entity-preview]", e);
    return NextResponse.json({ preview: null }, { status: 200 });
  }
}
