import { Prisma } from "@prisma/client";

/** Serialize resource writes across booking workflows in PostgreSQL row order. */
export async function lockBookingUnits(
  tx: Prisma.TransactionClient, businessId: string, unitIds: readonly string[],
): Promise<boolean> {
  const ids = [...new Set(unitIds)];
  if (!ids.length) return true;
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "BookingUnit"
    WHERE "businessId" = ${businessId} AND "id" IN (${Prisma.join(ids)})
    ORDER BY "id" FOR UPDATE
  `;
  return rows.length === ids.length;
}

/** The exclusion constraint still sees expired HELD rows until their status changes. */
export async function expireBookingUnitHolds(tx: Prisma.TransactionClient, unitIds: readonly string[]) {
  if (!unitIds.length) return;
  await tx.$executeRaw`
    WITH deadline AS (SELECT clock_timestamp() AT TIME ZONE 'UTC' AS utc)
    UPDATE "BookingAllocation"
    SET "status" = 'EXPIRED', "updatedAt" = deadline.utc
    FROM deadline
    WHERE "bookingUnitId" IN (${Prisma.join(unitIds)}) AND "status" = 'HELD'
      AND "expiresAt" <= deadline.utc
  `;
}

export function isAllocationOverlapError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string; meta?: { code?: string; database_error?: string } };
  return value.code === "23P01" ||
    (value.code === "P2010" && value.meta?.code === "23P01") ||
    Boolean(value.message?.includes("BookingAllocation_no_active_overlap") ||
      value.meta?.database_error?.includes("BookingAllocation_no_active_overlap"));
}
