import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DiscoveryTaxonomyAxis } from "@prisma/client";

export const runtime = "nodejs";

/** Публичный read-only список жанров (DiscoveryTaxonomyAxis.GENRE), только активные. */
export async function GET() {
  try {
    const rows = await prisma.discoveryTaxonomyEntry.findMany({
      where: { axis: DiscoveryTaxonomyAxis.GENRE, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        sortOrder: true,
        isActive: true,
      },
    });

    return NextResponse.json({ genres: rows });
  } catch (e) {
    console.error("[public/genres]", e);
    return NextResponse.json({ genres: [] as unknown[], error: "fetch_failed" }, { status: 200 });
  }
}

