import { NextRequest, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import type { ArticleBlockEntityType } from "@/lib/publications/articleMvp";

const VALID_TYPES: ArticleBlockEntityType[] = ["EVENT", "PLACE", "OFFER", "ROUTE", "ARTICLE"];

export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type") as ArticleBlockEntityType | null;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (type === "PLACE") {
      const rows = await prisma.place.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        select: { id: true, title: true, slug: true },
        take: 10,
        orderBy: { title: "asc" },
      });
      return NextResponse.json({
        results: rows.map((r) => ({ id: r.id, type: "PLACE", title: r.title, slug: r.slug })),
      });
    }

    if (type === "EVENT") {
      const rows = await prisma.activity.findMany({
        where: {
          type: ActivityType.EVENT,
          title: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          place: { select: { city: { select: { name: true } } } },
        },
        take: 10,
        orderBy: { title: "asc" },
      });
      return NextResponse.json({
        results: rows.map((r) => ({
          id: r.id,
          type: "EVENT",
          title: r.title,
          slug: r.slug,
          subtitle: r.place?.city?.name ?? undefined,
        })),
      });
    }

    if (type === "OFFER") {
      const rows = await prisma.offer.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        select: {
          id: true,
          title: true,
          slug: true,
          place: { select: { city: { select: { name: true } } } },
        },
        take: 10,
        orderBy: { title: "asc" },
      });
      return NextResponse.json({
        results: rows.map((r) => ({
          id: r.id,
          type: "OFFER",
          title: r.title,
          slug: r.slug,
          subtitle: r.place?.city?.name ?? undefined,
        })),
      });
    }

    if (type === "ROUTE") {
      const rows = await prisma.route.findMany({
        where: { title: { contains: q, mode: "insensitive" } },
        select: {
          id: true,
          title: true,
          slug: true,
          city: { select: { name: true } },
        },
        take: 10,
        orderBy: { title: "asc" },
      });
      return NextResponse.json({
        results: rows.map((r) => ({
          id: r.id,
          type: "ROUTE",
          title: r.title,
          slug: r.slug,
          subtitle: r.city?.name ?? undefined,
        })),
      });
    }

    // ARTICLE
    const rows = await prisma.article.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, slug: true },
      take: 10,
      orderBy: { title: "asc" },
    });
    return NextResponse.json({
      results: rows.map((r) => ({
        id: r.id,
        type: "ARTICLE",
        title: r.title,
        slug: r.slug ?? undefined,
      })),
    });
  } catch (e) {
    console.error("[entity-search]", e);
    return NextResponse.json({ results: [] });
  }
}
