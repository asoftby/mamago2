import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { SearchResultItem, SearchResultType } from "@/lib/search/types";
import { logSearchQuery } from "@/lib/search/logSearchQuery";
import { getCurrentUser } from "@/lib/auth/server";

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
  const cityId = searchParams.get("cityId") || undefined;

  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }

  try {
    // Get current user for logging (optional)
    const user = await getCurrentUser().catch(() => null);

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
        summaryLine: true,
        metaLine: true,
      },
    });

    const results: SearchResultItem[] = docs.map((d) => ({
      id: d.entityId,
      type: entityTypeToResultType(d.entityType),
      title: d.title,
      url: d.urlPath,
      imageUrl: d.imageUrl,
      summaryLine: d.summaryLine,
      metaLine: d.metaLine,
    }));

    // Log search query (fire-and-forget)
    logSearchQuery({
      query: q,
      resultsCount: results.length,
      cityId,
      userId: user?.id,
      // sessionId can be added later from cookies/headers
    }).catch((err) => console.error("Search logging failed:", err));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[api/search]", e);
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }
}
