import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";

export const runtime = "nodejs";

function normalizeSlug(rawSlug: unknown, rawTitle: unknown): string {
  const explicit = typeof rawSlug === "string" ? rawSlug.trim() : "";
  const fromTitle = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const candidate = slugifyLabelToValue(explicit || fromTitle);
  return candidate;
}

export async function GET(req: Request) {
  try {
    const user = await requireAdminOrModerator();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const selectedIds = Array.from(
      new Set(
        url.searchParams
          .get("selectedIds")
          ?.split(",")
          .map((value) => value.trim())
          .filter(Boolean) ?? [],
      ),
    );

    const tags = await prisma.discoveryTag.findMany({
      where: includeInactive
        ? undefined
        : selectedIds.length > 0
          ? {
              OR: [
                { isActive: true },
                { id: { in: selectedIds } },
              ],
            }
          : { isActive: true },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        indexingMode: true,
        reviewStatus: true,
        isActive: true,
        sortOrder: true,
        _count: {
          select: {
            articles: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });

    return NextResponse.json(
      tags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        title: tag.title,
        description: tag.description,
        seoTitle: tag.seoTitle,
        seoDescription: tag.seoDescription,
        indexingMode: tag.indexingMode,
        reviewStatus: tag.reviewStatus,
        isActive: tag.isActive,
        sortOrder: tag.sortOrder,
        articleCount: tag._count.articles,
      })),
      { status: 200, headers: { "X-Tag-Manager-Role": user.role } },
    );
  } catch (error) {
    console.error("[GET /api/admin/discovery-tags]", error);
    return NextResponse.json(
      { error: "Failed to fetch discovery tags" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const slug = normalizeSlug(body?.slug, body?.title);
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const seoTitle = typeof body?.seoTitle === "string" ? body.seoTitle.trim() || null : null;
  const seoDescription = typeof body?.seoDescription === "string" ? body.seoDescription.trim() || null : null;
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Math.floor(Number(body.sortOrder)) : 0;
  const isAdmin = user.role === "ADMIN";
  const indexingMode = body?.indexingMode ?? "AUTO";

  if (!title || title.length > 80 || !slug) {
    return NextResponse.json({ error: "Название тега обязательно (не более 80 символов)" }, { status: 400 });
  }
  if (!["AUTO", "INDEX", "NOINDEX"].includes(indexingMode) || (!isAdmin && indexingMode !== "AUTO")) {
    return NextResponse.json({ error: "Недопустимый режим индексации" }, { status: 403 });
  }
  const existing = await prisma.discoveryTag.findFirst({
    where: { OR: [{ slug }, { title: { equals: title, mode: "insensitive" } }] },
    select: { id: true, title: true, slug: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Такой тег уже существует", existing }, { status: 409 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const tag = await tx.discoveryTag.create({
        data: {
          title, slug, description, seoTitle, seoDescription, sortOrder,
          indexingMode,
          // Moderator suggestions are usable in drafts, but remain unpublished until admin approval.
          isActive: isAdmin && (body?.isActive === undefined ? true : body.isActive === true),
          reviewStatus: isAdmin ? "APPROVED" : "PENDING",
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: user.id, actorRole: user.role,
          action: "DISCOVERY_TAG_CREATE", entityType: "DiscoveryTag", entityId: tag.id,
          after: { title: tag.title, slug: tag.slug, isActive: tag.isActive, indexingMode: tag.indexingMode, reviewStatus: tag.reviewStatus },
        },
      });
      return tag;
    });
    invalidatePublicArticleLists();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Такой тег уже существует" }, { status: 409 });
    }
    console.error("[POST /api/admin/discovery-tags]", error);
    return NextResponse.json({ error: "Failed to create discovery tag" }, { status: 500 });
  }
}
