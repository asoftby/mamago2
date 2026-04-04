import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import { normalizeTaxonomySlug } from "@/lib/taxonomy/transliterateToSlug";
import {
  assertGenreUniqueInCategory,
  MSG_GENRE_SLUG_IN_CATEGORY,
} from "@/server/api/admin/genreUniqueness";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const item = await prisma.genre.findUnique({
      where: { id },
      include: { category: { select: { id: true, nameRu: true, slug: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
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
    const current = await prisma.genre.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextCategoryId =
      body.categoryId !== undefined ? String(body.categoryId).trim() : current.categoryId;
    const nextSlug =
      body.slug !== undefined ? normalizeTaxonomySlug(String(body.slug)) : current.slug;
    const nextName =
      body.name !== undefined ? String(body.name).trim() : current.name;

    if (body.name !== undefined && !nextName) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }

    if (body.categoryId !== undefined) {
      if (!nextCategoryId) {
        return NextResponse.json({ error: "categoryId cannot be empty" }, { status: 400 });
      }
      const cat = await prisma.eventCategory.findUnique({ where: { id: nextCategoryId } });
      if (!cat) {
        return NextResponse.json({ error: "Category not found" }, { status: 400 });
      }
    }

    const needsUniquenessCheck =
      body.name !== undefined || body.slug !== undefined || body.categoryId !== undefined;
    if (needsUniquenessCheck) {
      const u = await assertGenreUniqueInCategory(prisma, {
        categoryId: nextCategoryId,
        slug: nextSlug,
        name: nextName,
        excludeGenreId: current.id,
      });
      if (!u.ok) {
        return NextResponse.json({ error: u.error }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      data.name = nextName;
    }
    if (body.slug !== undefined) {
      data.slug = nextSlug;
    }
    if (body.categoryId !== undefined) {
      data.categoryId = nextCategoryId;
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

    const updated = await prisma.genre.update({
      where: { id },
      data,
      include: { category: { select: { id: true, nameRu: true, slug: true } } },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: MSG_GENRE_SLUG_IN_CATEGORY }, { status: 409 });
    }
    const j = prismaToHttpResponse(e);
    if (j) return j;
    console.error("admin genres PATCH:", e);
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
    await prisma.genre.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
