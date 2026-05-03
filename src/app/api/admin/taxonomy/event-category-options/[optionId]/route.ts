import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageEventCategories } from "@/lib/auth/eventCategoriesAdmin";
import { isPrismaValidationError } from "@/lib/prisma/prismaErrorKind";
import { EVENT_STEP1_CATEGORIES_TAG } from "@/server/admin/activities/get-activity-form-data";

export const runtime = "nodejs";

const SCHEMA_OUT_OF_SYNC_MESSAGE =
  "Схема БД не совпадает с кодом: выполните npx prisma migrate deploy (в dev можно npx prisma db push).";

export async function PATCH(req: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { optionId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.label !== undefined) {
    const v = String(body.label).trim();
    if (!v) return NextResponse.json({ error: "label cannot be empty" }, { status: 400 });
    data.label = v;
  }
  if (body.value !== undefined) {
    const v = String(body.value).trim();
    if (!v) return NextResponse.json({ error: "value cannot be empty" }, { status: 400 });
    data.value = v;
  }
  if (body.order !== undefined) {
    const n = Number(body.order);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }
    data.order = Math.floor(n);
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.eventCategoryOption.update({
      where: { id: optionId },
      data,
    });
    revalidateTag(EVENT_STEP1_CATEGORIES_TAG, "max");
    return NextResponse.json(updated);
  } catch (e) {
    if (isPrismaValidationError(e)) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "Опция с таким value уже есть у этой категории" },
          { status: 409 },
        );
      }
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (e.code === "P2021" || e.code === "P2022") {
        return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
      }
    }
    console.error("event-category-options PATCH:", e);
    return NextResponse.json({ error: "Не удалось обновить опцию" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ optionId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { optionId } = await params;
  try {
    await prisma.eventCategoryOption.delete({ where: { id: optionId } });
    revalidateTag(EVENT_STEP1_CATEGORIES_TAG, "max");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (e.code === "P2021" || e.code === "P2022") {
        return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
      }
    }
    console.error("event-category-options DELETE:", e);
    return NextResponse.json({ error: "Не удалось удалить опцию" }, { status: 500 });
  }
}
