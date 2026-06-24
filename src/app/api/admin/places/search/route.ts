import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";

export async function GET(request: NextRequest) {
  const user = await requireAdminOrModerator();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const excludeId = request.nextUrl.searchParams.get("excludeId")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ places: [] });
  }

  try {
    const places = await prisma.place.findMany({
      where: {
        archivedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { shortAddress: { contains: q, mode: "insensitive" } },
          { formattedAddr: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        shortAddress: true,
        formattedAddr: true,
        status: true,
        ownerBusinessId: true,
        ownerBusiness: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ title: "asc" }, { createdAt: "desc" }],
      take: 20,
    });

    return NextResponse.json({ places });
  } catch (error) {
    console.error("[admin-places-search] Failed to search places:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
