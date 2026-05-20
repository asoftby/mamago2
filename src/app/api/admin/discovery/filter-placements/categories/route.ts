import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const categories = await prisma.eventCategory.findMany({
    where: {
      publicationType: "EVENT",
      isActive: true,
      archivedAt: null,
      parentId: null,
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      nameRu: true,
      slug: true,
      sortOrder: true,
      _count: { select: { filterPlacements: true } },
    },
  });

  return NextResponse.json(categories);
}
