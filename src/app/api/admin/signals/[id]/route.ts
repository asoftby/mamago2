import { NextResponse } from "next/server";
import { Prisma, SignalDomain, SignalEntityType, SignalStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageSignalDefinitions } from "@/lib/auth/signalDefinitionsAdmin";
import { ensureEventCategorySlug } from "@/lib/taxonomy/eventCategorySlug";
import {
  assertSignalCanBecomeChild,
  assertValidSignalParentIdOrNull,
} from "@/lib/taxonomy/signalHierarchyServer";
import { assertNotSystemDelete, assertNotSystemKeyChange, systemEntityErrorResponse } from "@/lib/data-policy/systemEntityGuard";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

async function resolveSignalIdentifier(identifier: string) {
  const bySlug = await prisma.signalDefinition.findUnique({
    where: { slug: identifier },
    select: { id: true, slug: true },
  });
  if (bySlug) return bySlug;
  const byId = await prisma.signalDefinition.findUnique({
    where: { id: identifier },
    select: { id: true, slug: true },
  });
  return byId;
}

const SCHEMA_OUT_OF_SYNC_MESSAGE =
  "Схема БД не совпадает с кодом: выполните npx prisma migrate deploy (в dev можно npx prisma db push).";

function jsonFromPrismaError(e: unknown): NextResponse | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (e.code === "P2021" || e.code === "P2022") {
    return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
  }
  return null;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageSignalDefinitions(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const resolved = await resolveSignalIdentifier(id);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const item = await prisma.signalDefinition.findUnique({
    where: { id: resolved.id },
    include: {
      parent: { select: { id: true, title: true, slug: true } },
      options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
      _count: { select: { children: true, options: true } },
    },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (item.slug === "vibe") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageSignalDefinitions(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const resolved = await resolveSignalIdentifier(id);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();

  if (body.mode === "moveUp" || body.mode === "moveDown") {
    const current = await prisma.signalDefinition.findUnique({ where: { id: resolved.id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const siblings = await prisma.signalDefinition.findMany({
      where: { parentId: current.parentId },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    const idx = siblings.findIndex((x) => x.id === resolved.id);
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
      prisma.signalDefinition.update({
        where: { id: a.id },
        data: { order: b.order },
      }),
      prisma.signalDefinition.update({
        where: { id: b.id },
        data: { order: a.order },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  const data: Record<string, unknown> = {};

  if (body.parentId !== undefined) {
    const raw = body.parentId;
    const nextParentId =
      raw === null || raw === undefined || raw === "" ? null : String(raw);
    try {
      await assertValidSignalParentIdOrNull(nextParentId);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid parent" },
        { status: 400 },
      );
    }
    if (nextParentId === resolved.id) {
      return NextResponse.json({ error: "Cannot set parent to self" }, { status: 400 });
    }
    if (nextParentId != null) {
      try {
        await assertSignalCanBecomeChild(resolved.id);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Cannot assign parent" },
          { status: 400 },
        );
      }
    }
    data.parentId = nextParentId;
  }

  if (body.title !== undefined) {
    const v = String(body.title).trim();
    if (!v) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    data.title = v;
    data.titleEn = v;
  }
  if (body.slug !== undefined) {
    const existing = await prisma.signalDefinition.findUnique({
      where: { id: resolved.id },
      select: { title: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const s = ensureEventCategorySlug(String(body.slug), existing.title);
    const other = await prisma.signalDefinition.findFirst({
      where: { slug: s, NOT: { id: resolved.id } },
    });
    if (other) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    data.slug = s;
  }
  if (body.icon !== undefined) {
    data.icon = body.icon === null || body.icon === "" ? null : String(body.icon).trim();
  }
  if (body.order !== undefined) {
    const n = Number(body.order);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }
    data.order = Math.floor(n);
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.isFeatured !== undefined) data.isFeatured = Boolean(body.isFeatured);

  // New fields for domain architecture
  if (body.domain !== undefined) {
    if (body.domain === null) {
      data.domain = null;
    } else if (Object.values(SignalDomain).includes(body.domain)) {
      data.domain = body.domain;
    } else {
      return NextResponse.json({ error: "Invalid domain value" }, { status: 400 });
    }
  }

  if (body.entityTypes !== undefined) {
    if (Array.isArray(body.entityTypes)) {
      const validTypes = body.entityTypes.filter((type: unknown) => 
        Object.values(SignalEntityType).includes(type as SignalEntityType)
      );
      data.entityTypes = validTypes;
    } else {
      return NextResponse.json({ error: "entityTypes must be an array" }, { status: 400 });
    }
  }

  if (body.status !== undefined) {
    if (Object.values(SignalStatus).includes(body.status)) {
      data.status = body.status;
    } else {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
  }

  if (body.replacedById !== undefined) {
    if (body.replacedById === null) {
      data.replacedById = null;
    } else if (typeof body.replacedById === "string") {
      // Validate that the referenced signal exists
      const replacedSignal = await prisma.signalDefinition.findUnique({
        where: { id: body.replacedById },
      });
      if (!replacedSignal) {
        return NextResponse.json(
          { error: "replacedById references non-existent signal" },
          { status: 400 }
        );
      }
      data.replacedById = body.replacedById;
    } else {
      return NextResponse.json({ error: "replacedById must be a string or null" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.signalDefinition.update({
      where: { id: resolved.id },
      data,
      include: {
        parent: { select: { id: true, title: true, slug: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { children: true, options: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const schema = jsonFromPrismaError(e);
    if (schema) return schema;
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageSignalDefinitions(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const resolved = await resolveSignalIdentifier(id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signal = await prisma.signalDefinition.findUnique({ where: { id: resolved.id }, select: { isSystem: true, slug: true } });
  if (!signal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    assertNotSystemDelete(signal);
  } catch (e) {
    const err = systemEntityErrorResponse(e);
    if (err) return NextResponse.json(err, { status: 403 });
  }

  const n = await prisma.signalDefinition.count({ where: { parentId: resolved.id } });
  if (n > 0) {
    return NextResponse.json({ error: "Delete child signals first" }, { status: 409 });
  }

  try {
    await prisma.signalDefinition.delete({ where: { id: resolved.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
