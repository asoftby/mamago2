import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { slugifyLabelToValue } from "@/lib/slugifyLabelToValue";

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
        isActive: tag.isActive,
        sortOrder: tag.sortOrder,
        articleCount: tag._count.articles,
      })),
      { status: 200 },
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
  const description =
    typeof body?.description === "string" ? body.description.trim() || null : null;
  const seoTitle = typeof body?.seoTitle === "string" ? body.seoTitle.trim() || null : null;
  const seoDescription =
    typeof body?.seoDescription === "string" ? body.seoDescription.trim() || null : null;
  const sortOrder = Number.isFinite(Number(body?.sortOrder))
    ? Math.floor(Number(body?.sortOrder))
    : 0;
  const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    const created = await prisma.discoveryTag.create({
      data: {
        title,
        slug,
        description,
        seoTitle,
        seoDescription,
        sortOrder,
        isActive,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Tag with this slug already exists" }, { status: 409 });
    }
    console.error("[POST /api/admin/discovery-tags]", error);
    return NextResponse.json({ error: "Failed to create discovery tag" }, { status: 500 });
  }
}
