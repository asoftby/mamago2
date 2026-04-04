import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export const SCHEMA_OUT_OF_SYNC_MESSAGE =
  "Схема БД не совпадает с кодом: выполните npx prisma migrate deploy (в dev можно npx prisma db push).";

/**
 * Маппинг типичных ошибок Prisma/БД в HTTP-ответ (миграции, недостающие таблицы).
 */
export function prismaToHttpResponse(e: unknown): NextResponse | null {
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021" || e.code === "P2022") {
      return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
    }
    // Нет применённых миграций / рассинхрон
    if (e.code === "P3005" || e.code === "P3018") {
      return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
    }
  }

  const msg = e instanceof Error ? e.message : String(e);
  const ctor = e instanceof Error ? e.constructor.name : "";

  if (
    /does not exist|UndefinedTable|42P01|не существует/i.test(msg) &&
    /table|relation|таблиц/i.test(msg)
  ) {
    return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
  }

  // Колонка / enum в БД отсутствует или движок вернул raw Postgres (42703) — часто не P2022.
  if (
    ctor === "PrismaClientUnknownRequestError" ||
    ctor === "PrismaClientValidationError"
  ) {
    if (
      /42703|42P01|undefined_column|column\s+.*does not exist|does not exist in the current database/i.test(
        msg,
      ) ||
      /publicationType|EventCategoryPublicationType/i.test(msg)
    ) {
      return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
    }
    // Старый Prisma Client без новых полей в UserUpdateInput — «Unknown arg `familyRole` …»
    if (/Unknown arg|Unknown argument/i.test(msg)) {
      return NextResponse.json({ error: SCHEMA_OUT_OF_SYNC_MESSAGE }, { status: 503 });
    }
  }

  return null;
}
