import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

function normalizeSlug(rawSlug: unknown, rawTitle: unknown): string {
  const explicit = typeof rawSlug === "string" ? rawSlug.trim() : "";
  const fromTitle = typeof rawTitle === "string" ? rawTitle.trim() : "";
  return slugifyLabelToValue(explicit || fromTitle);
}

async function requireManager() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return null;
  }
  return user;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await requireManager();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tag = await prisma.discoveryTag.findUnique({ where: { id } });
  if (!tag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(tag);
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const user = await requireManager();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const existing = await prisma.discoveryTag.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const title = body?.title !== undefined ? String(body.title).trim() : existing.title;
  const slug = body?.slug !== undefined || body?.title !== undefined
    ? normalizeSlug(body?.slug, body?.title ?? title)
    : existing.slug;
  if (!title || title.length > 80 || !slug) {
    return NextResponse.json({ error: "Название тега обязательно (не более 80 символов)" }, { status: 400 });
  }
  const indexingMode = body?.indexingMode ?? existing.indexingMode;
  const reviewStatus = body?.reviewStatus ?? existing.reviewStatus;
  const isActive = body?.isActive === undefined ? existing.isActive : body.isActive === true;
  const group = body?.group ?? existing.group;
  if (!["PLACES", "ENTERTAINMENT", "INTERESTS", "DEVELOPMENT", "CELEBRATIONS", "FAMILY", "TRAVEL", "OTHER"].includes(group)) {
    return NextResponse.json({ error: "Недопустимая тематическая группа" }, { status: 400 });
  }
  if (!["AUTO", "INDEX", "NOINDEX"].includes(indexingMode) ||
      !["APPROVED", "PENDING"].includes(reviewStatus)) {
    return NextResponse.json({ error: "Недопустимый статус тега" }, { status: 400 });
  }
  if (user.role !== "ADMIN" &&
      (indexingMode !== existing.indexingMode || reviewStatus !== existing.reviewStatus || isActive !== existing.isActive)) {
    return NextResponse.json({ error: "Управление публикацией и индексацией доступно только администратору" }, { status: 403 });
  }
  if (reviewStatus === "PENDING" && isActive) {
    return NextResponse.json({ error: "Сначала одобрите предложенный тег" }, { status: 400 });
  }
  const duplicate = await prisma.discoveryTag.findFirst({
    where: { id: { not: id }, OR: [{ slug }, { title: { equals: title, mode: "insensitive" } }] },
    select: { id: true },
  });
  if (duplicate) return NextResponse.json({ error: "Такой тег уже существует" }, { status: 409 });
  if (existing.slug !== slug && existing.isActive) {
    // Existing public URLs require a separate reviewed redirect migration.
    return NextResponse.json({ error: "Slug опубликованного тега нельзя менять без настройки редиректа" }, { status: 400 });
  }

  const data = {
    title, slug, indexingMode, reviewStatus, isActive, group,
    description: body?.description === undefined ? existing.description : String(body.description ?? "").trim() || null,
    seoTitle: body?.seoTitle === undefined ? existing.seoTitle : String(body.seoTitle ?? "").trim() || null,
    seoDescription: body?.seoDescription === undefined
      ? existing.seoDescription : String(body.seoDescription ?? "").trim() || null,
    sortOrder: body?.sortOrder === undefined
      ? existing.sortOrder
      : Number.isFinite(Number(body.sortOrder)) ? Math.floor(Number(body.sortOrder)) : existing.sortOrder,
  };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const tag = await tx.discoveryTag.update({ where: { id }, data });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id, actorRole: user.role,
          action: "DISCOVERY_TAG_UPDATE", entityType: "DiscoveryTag", entityId: id,
          before: { title: existing.title, slug: existing.slug, group: existing.group, description: existing.description, seoTitle: existing.seoTitle, seoDescription: existing.seoDescription, isActive: existing.isActive, indexingMode: existing.indexingMode, reviewStatus: existing.reviewStatus },
          after: { title: tag.title, slug: tag.slug, group: tag.group, description: tag.description, seoTitle: tag.seoTitle, seoDescription: tag.seoDescription, isActive: tag.isActive, indexingMode: tag.indexingMode, reviewStatus: tag.reviewStatus },
        },
      });
      return tag;
    });
    invalidatePublicArticleLists();
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Такой тег уже существует" }, { status: 409 });
    }
    console.error("[PATCH /api/admin/discovery-tags/[id]]", error);
    return NextResponse.json({ error: "Failed to update discovery tag" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await requireManager();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const disabled = await prisma.$transaction(async (tx) => {
      const tag = await tx.discoveryTag.update({ where: { id }, data: { isActive: false } });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id, actorRole: user.role,
          action: "DISCOVERY_TAG_DISABLE", entityType: "DiscoveryTag", entityId: id,
          after: { isActive: false, slug: tag.slug },
        },
      });
      return tag;
    });
    invalidatePublicArticleLists();
    return NextResponse.json({ ok: true, tag: disabled });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[DELETE /api/admin/discovery-tags/[id]]", error);
    return NextResponse.json({ error: "Failed to delete discovery tag" }, { status: 500 });
  }
}
