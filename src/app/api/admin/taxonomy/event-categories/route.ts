import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { ensureEventCategorySlug } from "@/lib/taxonomy/eventCategorySlug";
import { assertValidParentIdOrNull } from "@/lib/taxonomy/eventCategoryHierarchy";

export const runtime = "nodejs";

const SCHEMA_OUT_OF_SYNC_MESSAGE =
  "Схема БД не совпадает с кодом: выполните npx prisma migrate deploy (в dev можно npx prisma db push).";

function jsonFromPrismaError(e: unknown): NextResponse | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (e.code === "P2021" || e.code === "P2022") {
    return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
  }
  if (e.code === "P2003") {
    return NextResponse.json(
      { error: "Некорректная родительская категория (связь с БД нарушена)" },
      { status: 400 },
    );
  }
  return null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const items = await prisma.eventCategory.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: {
        parent: { select: { id: true, nameRu: true, slug: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { activities: true, children: true } },
      },
    });
    return NextResponse.json(items);
  } catch (e) {
    const schema = jsonFromPrismaError(e);
    if (schema) return schema;
    console.error("event-categories GET:", e);
    return NextResponse.json({ error: "Не удалось загрузить категории" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const slugRaw = String(body.slug ?? "").trim();

  let nameRu = String(body.nameRu ?? "").trim();
  const titleFromBody = body.title != null ? String(body.title).trim() : "";
  if (!nameRu && titleFromBody) {
    nameRu = titleFromBody;
  }

  const parentIdRaw = body.parentId;
  const parentId =
    parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === ""
      ? null
      : String(parentIdRaw);

  const icon = body.icon != null ? String(body.icon).trim() || null : null;
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.floor(body.sortOrder)
      : 0;
  const isActive = Boolean(body.isActive ?? true);
  const isFeatured = Boolean(body.isFeatured ?? false);

  if (!nameRu) {
    return NextResponse.json({ error: "nameRu is required" }, { status: 400 });
  }

  const nameEn = nameRu;

  const slug = ensureEventCategorySlug(slugRaw, nameRu);

  try {
    await assertValidParentIdOrNull(parentId);

    const exists = await prisma.eventCategory.findUnique({ where: { slug } });
    if (exists) {
      return NextResponse.json(
        { error: "Категория с таким slug уже есть" },
        { status: 409 },
      );
    }

    const created = await prisma.eventCategory.create({
      data: {
        nameRu,
        nameEn,
        slug,
        icon,
        sortOrder,
        isActive,
        isFeatured,
        parentId,
      },
      include: {
        parent: { select: { id: true, nameRu: true, slug: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { activities: true, children: true } },
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    const schema = jsonFromPrismaError(e);
    if (schema) return schema;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Категория с таким slug уже есть" },
        { status: 409 },
      );
    }
    if (e instanceof Error) {
      if (e.message === "Parent not found" || e.message === "Only a root category can be a parent") {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }
    console.error("event-categories POST:", e);
    return NextResponse.json(
      { error: "Не удалось сохранить категорию" },
      { status: 500 },
    );
  }
}
