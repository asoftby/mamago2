/**
 * Shared "obtain DB time" helper. Used anywhere a DB-observed timestamp is
 * required instead of process wall-clock (`new Date()`) — snapshot
 * `startedAt`, worker `workerStartedAt`, etc.
 */
import type { PrismaClient } from "@prisma/client";

export async function getDbNow(prisma: PrismaClient): Promise<Date> {
  const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return rows[0].now;
}
