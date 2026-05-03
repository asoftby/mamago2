import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { EventCategoryPublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { ensureEventCategorySlug } from "@/lib/taxonomy/eventCategorySlug";
import {
  assertCanBecomeChild,
  assertValidParentIdOrNull,
} from "@/lib/taxonomy/eventCategoryHierarchy";
import {
  mapCategoryWithParent,
  parseEventCategoryPublicationType,
} from "@/lib/taxonomy/eventCategoryPublicationType";
import { EVENT_STEP1_CATEGORIES_TAG } from "@/server/admin/activities/get-activity-form-data";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const item = await prisma.eventCategory.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, nameRu: true, slug: true, publicationType: true } },
      options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
      _count: { select: { activities: true, children: true } },
    },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(mapCategoryWithParent(item));
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.mode === "moveUp" || body.mode === "moveDown") {
    const current = await prisma.eventCategory.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const siblings = await prisma.eventCategory.findMany({
      where: { parentId: current.parentId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    const idx = siblings.findIndex((x) => x.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const swapIdx = body.mode === "moveUp" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return NextResponse.json({ ok: true });
    }
    const a = siblings[idx];
    const b = siblings[swapIdx];
    await prisma.$transaction([
      prisma.eventCategory.update({
        where: { id: a.id },
        data: { sortOrder: b.sortOrder },
      }),
      prisma.eventCategory.update({
        where: { id: b.id },
        data: { sortOrder: a.sortOrder },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  const current = await prisma.eventCategory.findUnique({
    where: { id },
    select: {
      parentId: true,
      publicationType: true,
      _count: { select: { children: true } },
    },
  });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    parentId?: string | null;
    nameRu?: string;
    nameEn?: string;
    slug?: string;
    icon?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    isFeatured?: boolean;
    supportsProgram?: boolean;
    selectableInProgram?: boolean;
    publicationType?: EventCategoryPublicationType;
  } = {};

  const hasParentPatch = body.parentId !== undefined;
  const hasTypePatch = body.type !== undefined;

  if (hasParentPatch && hasTypePatch) {
    return NextResponse.json(
      { error: "Укажите либо parentId, либо type в одном запросе" },
      { status: 400 },
    );
  }

  if (hasParentPatch) {
    const raw = body.parentId;
    const nextParentId =
      raw === null || raw === undefined || raw === "" ? null : String(raw);
    try {
      await assertValidParentIdOrNull(nextParentId, {
        childType: current.publicationType,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid parent" },
        { status: 400 },
      );
    }
    if (nextParentId === id) {
      return NextResponse.json({ error: "Cannot set parent to self" }, { status: 400 });
    }
    if (nextParentId != null) {
      try {
        await assertCanBecomeChild(id);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Cannot assign parent" },
          { status: 400 },
        );
      }
      const parent = await prisma.eventCategory.findUnique({
        where: { id: nextParentId },
        select: { publicationType: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent not found" }, { status: 400 });
      }
      if (parent.publicationType !== current.publicationType) {
        return NextResponse.json(
          { error: "Parent category type must match child type" },
          { status: 400 },
        );
      }
    }
    data.parentId = nextParentId;
  }

  if (hasTypePatch) {
    const t = parseEventCategoryPublicationType(body.type);
    if (!t) {
      return NextResponse.json(
        { error: "Invalid type (EVENT | PLACE | OFFER | ROUTE | ARTICLE)" },
        { status: 400 },
      );
    }
    if (current.parentId != null) {
      return NextResponse.json(
        { error: "Тип задаётся родительской категорией для подкатегорий" },
        { status: 400 },
      );
    }
    if (current._count.children > 0) {
      return NextResponse.json(
        { error: "Смените тип после удаления или переноса подкатегорий" },
        { status: 400 },
      );
    }
    data.publicationType = t;
  }

  if (body.nameRu !== undefined) {
    const v = String(body.nameRu).trim();
    if (!v) return NextResponse.json({ error: "nameRu cannot be empty" }, { status: 400 });
    data.nameRu = v;
    data.nameEn = v;
  }
  if (body.slug !== undefined) {
    const existingForSlug = await prisma.eventCategory.findUnique({
      where: { id },
      select: { nameRu: true },
    });
    if (!existingForSlug) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const s = ensureEventCategorySlug(String(body.slug), existingForSlug.nameRu);
    const other = await prisma.eventCategory.findFirst({
      where: { slug: s, NOT: { id } },
    });
    if (other) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    data.slug = s;
  }
  if (body.icon !== undefined) {
    data.icon = body.icon === null || body.icon === "" ? null : String(body.icon).trim();
  }
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Invalid sortOrder" }, { status: 400 });
    }
    data.sortOrder = Math.floor(n);
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);
  if (body.supportsProgram !== undefined) data.supportsProgram = Boolean(body.supportsProgram);
  if (body.selectableInProgram !== undefined) {
    data.selectableInProgram = Boolean(body.selectableInProgram);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.eventCategory.update({
      where: { id },
      data,
      include: {
        parent: { select: { id: true, nameRu: true, slug: true, publicationType: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { activities: true, children: true } },
      },
    });
    revalidateTag(EVENT_STEP1_CATEGORIES_TAG, "max");
    return NextResponse.json(mapCategoryWithParent(updated));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const n = await prisma.eventCategory.count({ where: { parentId: id } });
  if (n > 0) {
    return NextResponse.json(
      { error: "Delete subcategories first" },
      { status: 409 },
    );
  }

  try {
    await prisma.eventCategory.delete({ where: { id } });
    revalidateTag(EVENT_STEP1_CATEGORIES_TAG, "max");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
