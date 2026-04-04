import { NextResponse } from "next/server";
import { OccasionType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import { normalizeTaxonomySlug } from "@/lib/taxonomy/transliterateToSlug";

export const runtime = "nodejs";

function parseOccasionType(raw: unknown): OccasionType | null {
  if (typeof raw !== "string") return null;
  const u = raw.toUpperCase();
  if (u === "HOLIDAY" || u === "SEASON" || u === "EVENT" || u === "FAMILY") {
    return u as OccasionType;
  }
  return null;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const item = await prisma.occasion.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
    console.error("occasions/[id] GET:", e);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const current = await prisma.occasion.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (!v) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      data.name = v;
    }
    if (body.slug !== undefined) {
      const s = normalizeTaxonomySlug(String(body.slug));
      const other = await prisma.occasion.findFirst({
        where: { slug: s, NOT: { id } },
      });
      if (other) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
      data.slug = s;
    }
    if (body.type !== undefined) {
      const t = parseOccasionType(body.type);
      if (!t) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
      }
      data.type = t;
    }
    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: "Invalid sortOrder" }, { status: 400 });
      }
      data.sortOrder = Math.floor(n);
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.occasion.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
    console.error("occasions/[id] PATCH:", e);
    return NextResponse.json({ error: "Не удалось сохранить" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.occasion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
