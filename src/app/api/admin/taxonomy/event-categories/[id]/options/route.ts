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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageEventCategories(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const label = String(body.label ?? "").trim();
  const value = String(body.value ?? "").trim();
  if (!label || !value) {
    return NextResponse.json({ error: "label and value required" }, { status: 400 });
  }

  const order =
    typeof body.order === "number" && Number.isFinite(body.order)
      ? Math.floor(body.order)
      : 0;
  const isActive = Boolean(body.isActive ?? true);

  try {
    const created = await prisma.eventCategoryOption.create({
      data: { categoryId: id, label, value, order, isActive },
    });
    revalidateTag(EVENT_STEP1_CATEGORIES_TAG, "max");
    return NextResponse.json(created);
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
      if (e.code === "P2003") {
        return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
      }
      if (e.code === "P2021" || e.code === "P2022") {
        return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
      }
    }
    console.error("event-categories/[id]/options POST:", e);
    return NextResponse.json({ error: "Не удалось создать опцию" }, { status: 500 });
  }
}
