import { NextResponse } from "next/server";
import { DiscoveryTaxonomyAxis, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { transliterateToSlug } from "@/lib/taxonomy/transliterateToSlug";

export const runtime = "nodejs";

const SCHEMA_OUT_OF_SYNC_MESSAGE =
  "Схема БД не совпадает с кодом: выполните npx prisma migrate deploy (в dev можно npx prisma db push).";

function jsonFromPrismaError(e: unknown): NextResponse | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (e.code === "P2021" || e.code === "P2022") {
    return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
  }
  return null;
}

function parseAxis(raw: string | null): DiscoveryTaxonomyAxis | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === "OCCASION" || u === "THEME" || u === "GENRE") {
    return u as DiscoveryTaxonomyAxis;
  }
  return null;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const axis = parseAxis(searchParams.get("axis"));
  if (!axis) {
    return NextResponse.json({ error: "axis=OCCASION|THEME|GENRE required" }, { status: 400 });
  }

  try {
    const items = await prisma.discoveryTaxonomyEntry.findMany({
      where: { axis },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return NextResponse.json(items);
  } catch (e) {
    const j = jsonFromPrismaError(e);
    if (j) return j;
    console.error("taxonomy-entries GET:", e);
    return NextResponse.json({ error: "Не удалось загрузить записи" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const axis = parseAxis(typeof body.axis === "string" ? body.axis : null);
  const title = String(body.title ?? "").trim();
  let slug = String(body.slug ?? "").trim();
  if (!axis) {
    return NextResponse.json({ error: "Invalid axis" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!slug) {
    slug = transliterateToSlug(title);
  }

  try {
    const existing = await prisma.discoveryTaxonomyEntry.findFirst({
      where: { axis, slug },
    });
    if (existing) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const created = await prisma.discoveryTaxonomyEntry.create({
      data: {
        axis,
        title,
        slug,
        sortOrder: 0,
        isActive: true,
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    const j = jsonFromPrismaError(e);
    if (j) return j;
    console.error("taxonomy-entries POST:", e);
    return NextResponse.json({ error: "Не удалось создать запись" }, { status: 500 });
  }
}
