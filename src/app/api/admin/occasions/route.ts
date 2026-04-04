import { NextResponse } from "next/server";
import { OccasionType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import { normalizeTaxonomySlug, transliterateToSlug } from "@/lib/taxonomy/transliterateToSlug";

export const runtime = "nodejs";

function parseOccasionType(raw: unknown): OccasionType | null {
  if (typeof raw !== "string") return null;
  const u = raw.toUpperCase();
  if (u === "HOLIDAY" || u === "SEASON" || u === "EVENT" || u === "FAMILY") {
    return u as OccasionType;
  }
  return null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const items = await prisma.occasion.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return NextResponse.json(items);
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
    console.error("occasions GET:", e);
    return NextResponse.json({ error: "Не удалось загрузить поводы" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  let slug = String(body.slug ?? "").trim();

  let type: OccasionType = "HOLIDAY";
  if (body.type !== undefined && body.type !== null && String(body.type).trim() !== "") {
    const t = parseOccasionType(body.type);
    if (!t) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    type = t;
  }

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!slug) {
    slug = transliterateToSlug(name);
  } else {
    slug = normalizeTaxonomySlug(slug);
  }

  try {
    const existing = await prisma.occasion.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const created = await prisma.occasion.create({
      data: {
        name,
        slug,
        type,
        sortOrder: 0,
        isActive: true,
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
    console.error("occasions POST:", e);
    return NextResponse.json({ error: "Не удалось создать повод" }, { status: 500 });
  }
}
