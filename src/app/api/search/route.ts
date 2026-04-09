import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { SearchResultItem, SearchResultType } from "@/lib/search/types";

function entityTypeToResultType(t: string): SearchResultType {
  if (
    t === "activity" ||
    t === "offer" ||
    t === "place" ||
    t === "route" ||
    t === "article"
  ) {
    return t;
  }
  return "article";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "8", 10), 1), 20);

  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }

  try {
    const docs = await prisma.searchDocument.findMany({
      where: {
        isPublished: true,
        searchText: { contains: q, mode: "insensitive" },
      },
      take: limit,
      orderBy: [{ boost: "desc" }, { updatedAt: "desc" }],
      select: {
        entityId: true,
        entityType: true,
        title: true,
        urlPath: true,
        imageUrl: true,
        metaLine: true,
      },
    });

    const results: SearchResultItem[] = docs.map((d) => ({
      id: d.entityId,
      type: entityTypeToResultType(d.entityType),
      title: d.title,
      url: d.urlPath,
      imageUrl: d.imageUrl,
      metaLine: d.metaLine,
    }));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[api/search]", e);
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }
}
