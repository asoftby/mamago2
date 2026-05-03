import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import { normalizeTaxonomySlug, transliterateToSlug } from "@/lib/taxonomy/transliterateToSlug";
import {
  assertGenreUniqueInCategory,
  MSG_GENRE_SLUG_IN_CATEGORY,
} from "@/server/api/admin/genreUniqueness";
import { eventStep1GenresTag } from "@/server/admin/activities/get-activity-form-data";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const items = await prisma.genre.findMany({
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: {
        category: { select: { id: true, nameRu: true, slug: true } },
      },
    });
    return NextResponse.json(items);
  } catch (e) {
    const j = prismaToHttpResponse(e);
    if (j) return j;
    console.error("admin genres GET:", e);
    return NextResponse.json({ error: "Не удалось загрузить жанры" }, { status: 500 });
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
  const categoryId = String(body.categoryId ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 });
  }

  const cat = await prisma.eventCategory.findUnique({ where: { id: categoryId } });
  if (!cat) {
    return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  if (!slug) {
    slug = transliterateToSlug(name);
  } else {
    slug = normalizeTaxonomySlug(slug);
  }

  const unique = await assertGenreUniqueInCategory(prisma, {
    categoryId,
    slug,
    name,
  });
  if (!unique.ok) {
    return NextResponse.json({ error: unique.error }, { status: 409 });
  }

  try {
    const created = await prisma.genre.create({
      data: {
        name,
        slug,
        categoryId,
        sortOrder: 0,
        isActive: true,
      },
      include: {
        category: { select: { id: true, nameRu: true, slug: true } },
      },
    });
    revalidateTag(eventStep1GenresTag(categoryId), "max");
    return NextResponse.json(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: MSG_GENRE_SLUG_IN_CATEGORY }, { status: 409 });
    }
    const j = prismaToHttpResponse(e);
    if (j) return j;
    console.error("admin genres POST:", e);
    return NextResponse.json({ error: "Не удалось создать жанр" }, { status: 500 });
  }
}
