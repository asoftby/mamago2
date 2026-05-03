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

/**
 * Parse a YYYY-MM-DD date string to a Date at start of day (UTC midnight).
 * For endsAt, pass endOfDay=true to get 23:59:59.999 so the occasion is
 * active for the full last day.
 */
function parseDateField(
  raw: unknown,
  endOfDay = false,
): Date | null | undefined {
  if (raw === null || raw === "") return null;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined; // invalid format
  const d = new Date(trimmed + (endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
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
    // Serialize dates as YYYY-MM-DD strings for the date inputs
    return NextResponse.json({
      ...item,
      startsAt: item.startsAt ? item.startsAt.toISOString().slice(0, 10) : null,
      endsAt: item.endsAt ? item.endsAt.toISOString().slice(0, 10) : null,
    });
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

    // ── Period fields ──────────────────────────────────────────────────────
    if ("startsAt" in body) {
      const parsed = parseDateField(body.startsAt, false);
      if (parsed === undefined) {
        return NextResponse.json({ error: "Invalid startsAt format (expected YYYY-MM-DD)" }, { status: 400 });
      }
      data.startsAt = parsed;
    }
    if ("endsAt" in body) {
      const parsed = parseDateField(body.endsAt, true);
      if (parsed === undefined) {
        return NextResponse.json({ error: "Invalid endsAt format (expected YYYY-MM-DD)" }, { status: 400 });
      }
      data.endsAt = parsed;
    }

    // Validate: if both dates present, endsAt must be >= startsAt
    const effectiveStartsAt = (data.startsAt as Date | null | undefined) ?? current.startsAt;
    const effectiveEndsAt = (data.endsAt as Date | null | undefined) ?? current.endsAt;
    if (effectiveStartsAt && effectiveEndsAt && effectiveEndsAt < effectiveStartsAt) {
      return NextResponse.json(
        { error: "endsAt cannot be earlier than startsAt" },
        { status: 400 },
      );
    }

    if (body.boostScore !== undefined) {
      const n = Number(body.boostScore);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Invalid boostScore (must be >= 0)" }, { status: 400 });
      }
      data.boostScore = Math.floor(n);
    }
    if (body.autoSuggest !== undefined) data.autoSuggest = Boolean(body.autoSuggest);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.occasion.update({ where: { id }, data });
    return NextResponse.json({
      ...updated,
      startsAt: updated.startsAt ? updated.startsAt.toISOString().slice(0, 10) : null,
      endsAt: updated.endsAt ? updated.endsAt.toISOString().slice(0, 10) : null,
    });
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
