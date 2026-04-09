import { NextRequest, NextResponse } from "next/server";
import { ActivityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";

export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type") as "EVENT" | "PLACE" | "OFFER" | null;

  if (!type || !["EVENT", "PLACE", "OFFER"].includes(type)) {
    return NextResponse.json({ error: "type must be EVENT, PLACE or OFFER" }, { status: 400 });
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (type === "PLACE") {
      const rows = await prisma.place.findMany({
        where: {
          title: { contains: q, mode: "insensitive" },
        },
        select: { id: true, title: true, slug: true },
        take: 10,
        orderBy: { title: "asc" },
      });
      return NextResponse.json({
        results: rows.map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
        })),
      });
    }

    if (type === "EVENT") {
      const rows = await prisma.activity.findMany({
        where: {
          type: ActivityType.EVENT,
          title: { contains: q, mode: "insensitive" },
        },
        select: { id: true, title: true, slug: true },
        take: 10,
        orderBy: { title: "asc" },
      });
      return NextResponse.json({
        results: rows.map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
        })),
      });
    }

    const rows = await prisma.offer.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
      },
      select: { id: true, title: true, slug: true },
      take: 10,
      orderBy: { title: "asc" },
    });
    return NextResponse.json({
      results: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
      })),
    });
  } catch (e) {
    console.error("[entity-search]", e);
    return NextResponse.json({ results: [] });
  }
}
