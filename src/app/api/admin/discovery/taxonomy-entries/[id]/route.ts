import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { normalizeTaxonomySlug } from "@/lib/taxonomy/transliterateToSlug";

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

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const item = await prisma.discoveryTaxonomyEntry.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (e) {
    const j = jsonFromPrismaError(e);
    if (j) return j;
    console.error("taxonomy-entries/[id] GET:", e);
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
    const current = await prisma.discoveryTaxonomyEntry.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const v = String(body.title).trim();
      if (!v) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      data.title = v;
    }
    if (body.slug !== undefined) {
      const s = normalizeTaxonomySlug(String(body.slug));
      const other = await prisma.discoveryTaxonomyEntry.findFirst({
        where: { axis: current.axis, slug: s, NOT: { id } },
      });
      if (other) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
      data.slug = s;
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

    const updated = await prisma.discoveryTaxonomyEntry.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const j = jsonFromPrismaError(e);
    if (j) return j;
    console.error("taxonomy-entries/[id] PATCH:", e);
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
    await prisma.discoveryTaxonomyEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const j = jsonFromPrismaError(e);
    if (j) return j;
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
