import { NextResponse } from "next/server";
import { Prisma, type EventCategoryPublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import { ensureEventCategorySlug } from "@/lib/taxonomy/eventCategorySlug";
import {
  mapCategoryWithParent,
  parseEventCategoryPublicationType,
} from "@/lib/taxonomy/eventCategoryPublicationType";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filterType = parseEventCategoryPublicationType(url.searchParams.get("type"));

  try {
    const items = await prisma.eventCategory.findMany({
      where: filterType ? { publicationType: filterType } : undefined,
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: {
        parent: { select: { id: true, nameRu: true, slug: true, publicationType: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { activities: true, children: true } },
      },
    });
    return NextResponse.json(items.map(mapCategoryWithParent));
  } catch (e) {
    const schema = prismaToHttpResponse(e);
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
  const supportsProgram = Boolean(body.supportsProgram ?? false);
  const selectableInProgram = Boolean(body.selectableInProgram ?? false);

  if (!nameRu) {
    return NextResponse.json({ error: "nameRu is required" }, { status: 400 });
  }

  let publicationType: EventCategoryPublicationType;
  if (parentId) {
    const parent = await prisma.eventCategory.findUnique({
      where: { id: parentId },
      select: { parentId: true, publicationType: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent not found" }, { status: 400 });
    }
    if (parent.parentId != null) {
      return NextResponse.json(
        { error: "Only a root category can be a parent" },
        { status: 400 },
      );
    }
    publicationType = parent.publicationType;
  } else {
    const t = parseEventCategoryPublicationType(body.type);
    if (!t) {
      return NextResponse.json(
        { error: "type is required (EVENT | PLACE | OFFER | ROUTE | ARTICLE)" },
        { status: 400 },
      );
    }
    publicationType = t;
  }

  const nameEn = nameRu;

  const slug = ensureEventCategorySlug(slugRaw, nameRu);

  try {
    const created = await prisma.eventCategory.create({
      data: {
        nameRu,
        nameEn,
        slug,
        publicationType,
        icon,
        sortOrder,
        isActive,
        isFeatured,
        supportsProgram,
        selectableInProgram,
        parentId,
      },
      include: {
        parent: { select: { id: true, nameRu: true, slug: true, publicationType: true } },
        options: { orderBy: [{ order: "asc" }, { value: "asc" }] },
        _count: { select: { activities: true, children: true } },
      },
    });
    return NextResponse.json(mapCategoryWithParent(created));
  } catch (e) {
    const schema = prismaToHttpResponse(e);
    if (schema) return schema;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Некорректная родительская категория (связь с БД нарушена)" },
        { status: 400 },
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Категория с таким slug уже есть" },
        { status: 409 },
      );
    }
    console.error("event-categories POST:", e);
    return NextResponse.json(
      { error: "Не удалось сохранить категорию" },
      { status: 500 },
    );
  }
}
