/**
 * Shared "obtain DB time" helper. Used anywhere a DB-observed timestamp is
 * required instead of process wall-clock (`new Date()`) — snapshot
 * `startedAt`, worker `workerStartedAt`, etc.
 *
 * Typed structurally (just the `$queryRaw` it needs) rather than against
 * the concrete `PrismaClient`, so callers running inside a
 * `prisma.$transaction(async (tx) => ...)` callback can pass the
 * transaction client `tx` too — no behavior change for existing callers,
 * which all already pass a real `PrismaClient`.
 */
import type { PrismaClient } from "@prisma/client";

export interface DbNowCapable {
  $queryRaw: PrismaClient["$queryRaw"];
}

export async function getDbNow(prisma: DbNowCapable): Promise<Date> {
  const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return rows[0].now;
}
