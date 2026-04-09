import { Prisma } from "@prisma/client";
import prisma, { searchIndexer } from "@/lib/prisma";

/**
 * Убеждаемся, что в PostgreSQL у enum "ContentStatus" есть значение DELETED.
 */
async function contentStatusHasDeletedValue(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'ContentStatus' AND e.enumlabel = 'DELETED'
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

function isDuplicateEnumValueError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /duplicate/i.test(msg) ||
    /already exists/i.test(msg) ||
    /42710/i.test(msg)
  );
}

async function ensureContentStatusDeletedEnumValue(): Promise<void> {
  if (await contentStatusHasDeletedValue()) {
    return;
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "ContentStatus" ADD VALUE 'DELETED'`);
  } catch (alterErr) {
    if (!isDuplicateEnumValueError(alterErr)) {
      throw alterErr;
    }
  }
}

/**
 * Мягкое удаление активности (события и т.д.).
 * Обновление через raw SQL: `prisma.activity.update({ status: DELETED })` может падать
 * с «Value 'DELETED' not found in enum», пока Prisma не считает значение допустимым для БД.
 */
export async function softDeleteActivityById(id: string): Promise<void> {
  await ensureContentStatusDeletedEnumValue();
  const affected = await prisma.$executeRaw(
    Prisma.sql`UPDATE "Activity" SET status = 'DELETED'::"ContentStatus" WHERE id = ${id}`,
  );
  const n = typeof affected === "bigint" ? Number(affected) : Number(affected);
  if (n !== 1) {
    throw new Error(`Activity not found: ${id}`);
  }
  await searchIndexer.upsertActivity(id);
}
