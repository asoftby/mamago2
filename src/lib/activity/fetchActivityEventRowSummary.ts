import prisma from "@/lib/prisma";

/**
 * Загрузка id / владельца / статуса события без Prisma enum-десериализации.
 * Если в БД status = DELETED, обычный findFirst может падать с
 * «Value 'DELETED' not found in enum 'ContentStatus'» при рассинхроне схемы.
 */
export type ActivityEventRowSummary = {
  id: string;
  ownerUserId: string;
  status: string;
};

export async function fetchActivityEventRowSummary(
  id: string,
): Promise<ActivityEventRowSummary | null> {
  const rows = await prisma.$queryRaw<ActivityEventRowSummary[]>`
    SELECT id, "ownerUserId", status::text AS status
    FROM "Activity"
    WHERE id = ${id}
      AND type::text = 'EVENT'
    LIMIT 1
  `;
  return rows[0] ?? null;
}
