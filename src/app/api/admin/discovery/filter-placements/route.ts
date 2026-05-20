import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const intent = searchParams.get("intent");
  const categoryId = searchParams.get("categoryId");

  const where: Record<string, unknown> = {};
  if (intent) {
    where.intent = intent;
    where.categoryId = null;
  } else if (categoryId) {
    where.categoryId = categoryId;
    where.intent = null;
  }

  const placements = await prisma.discoveryFilterPlacement.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: {
      filter: {
        include: { options: { select: { id: true } } },
      },
    },
  });

  return NextResponse.json(
    placements.map((p) => ({
      id: p.id,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      intent: p.intent,
      categoryId: p.categoryId,
      filter: {
        id: p.filter.id,
        slug: p.filter.slug,
        title: p.filter.title,
        type: p.filter.type,
        ui: p.filter.ui,
        optionsCount: p.filter.options.length,
      },
    }))
  );
}

export async function POST(req: Request) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const filterId = String(body.filterId || "").trim();
  const intent = body.intent ? String(body.intent).trim() : null;
  const categoryId = body.categoryId ? String(body.categoryId).trim() : null;
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;

  if (!filterId) {
    return NextResponse.json({ error: "filterId required" }, { status: 400 });
  }
  if (!intent && !categoryId) {
    return NextResponse.json(
      { error: "intent or categoryId required" },
      { status: 400 }
    );
  }

  const placement = await prisma.discoveryFilterPlacement.create({
    data: { filterId, intent, categoryId, sortOrder, isActive: true },
  });

  return NextResponse.json(placement, { status: 201 });
}
