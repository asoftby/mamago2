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

  try {
    const places = await prisma.place.findMany({
      where: {
        archivedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        OR:
          q.length >= 2
            ? [
                { title: { contains: q, mode: "insensitive" } },
                { shortAddress: { contains: q, mode: "insensitive" } },
                { formattedAddr: { contains: q, mode: "insensitive" } },
              ]
            : undefined,
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
      orderBy: q.length >= 2 ? [{ title: "asc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
      take: q.length >= 2 ? 20 : 5,
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
