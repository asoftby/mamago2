import { NextRequest, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import type { ArticleBlockEntityType } from "@/lib/publications/articleMvp";
import { loadArticlePlaceAdminPreview } from "@/lib/place/articlePlaceAdminPreview";

export type EntityPreviewPayload = {
  entityType: ArticleBlockEntityType;
  title: string;
  city: string | null;
  placeName?: string | null;
  address?: string | null;
  publicAvailable?: boolean;
};

const VALID_TYPES: ArticleBlockEntityType[] = ["EVENT", "PLACE", "OFFER", "ROUTE", "ARTICLE"];

export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type") as ArticleBlockEntityType | null;

  if (!id || !type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `id and type (${VALID_TYPES.join("|")}) required` },
      { status: 400 },
    );
  }

  try {
    if (type === "PLACE") {
      return NextResponse.json({ preview: await loadArticlePlaceAdminPreview(id) });
    }

    if (type === "EVENT") {
      const a = await prisma.activity.findUnique({
        where: { id },
        select: {
          title: true,
          type: true,
          place: {
            select: {
              title: true,
              shortAddress: true,
              formattedAddr: true,
              city: { select: { name: true } },
            },
          },
        },
      });
      if (!a || a.type !== ActivityType.EVENT) return NextResponse.json({ preview: null });
      return NextResponse.json({
        preview: {
          entityType: "EVENT",
          title: a.title,
          city: a.place?.city?.name ?? null,
          placeName: a.place?.title ?? null,
          address: a.place?.shortAddress ?? a.place?.formattedAddr ?? null,
        },
      });
    }

    if (type === "OFFER") {
      const o = await prisma.offer.findUnique({
        where: { id },
        select: {
          title: true,
          place: {
            select: {
              title: true,
              shortAddress: true,
              formattedAddr: true,
              city: { select: { name: true } },
            },
          },
        },
      });
      if (!o) return NextResponse.json({ preview: null });
      return NextResponse.json({
        preview: {
          entityType: "OFFER",
          title: o.title,
          city: o.place?.city?.name ?? null,
          placeName: o.place?.title ?? null,
          address: o.place?.shortAddress ?? o.place?.formattedAddr ?? null,
        },
      });
    }

    if (type === "ROUTE") {
      const r = await prisma.route.findUnique({
        where: { id },
        select: { title: true, city: { select: { name: true } } },
      });
      if (!r) return NextResponse.json({ preview: null });
      return NextResponse.json({
        preview: {
          entityType: "ROUTE",
          title: r.title,
          city: r.city?.name ?? null,
        },
      });
    }

    // ARTICLE
    const article = await prisma.article.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!article) return NextResponse.json({ preview: null });
    return NextResponse.json({
      preview: { entityType: "ARTICLE", title: article.title, city: null },
    });
  } catch (e) {
    console.error("[entity-preview]", e);
    return NextResponse.json({ preview: null }, { status: 200 });
  }
}
