import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { guestMaxLifetimeGenerations } from "@/server/services/guestPlanQuota";

/**
 * The guest quota of the day scenario (BACKLOG-230, PR 3c-2): only the FIRST build of a date counts. Another variant,
 * a replacement and a rebuild of a date already built are free; a second build of the same date is free too. A guest
 * has the same lifetime allowance as the old guest picks (GUEST_MAX_GENERATIONS, default 2), so a weekend (two dates)
 * is the whole allowance; after that the guest signs in or registers.
 */

export type GuestScenarioCharge = { ok: true; charged: boolean } | { ok: false; reason: "requires_auth" };

type Tx = Pick<Prisma.TransactionClient, "guestUsage">;

/** Pure rule: what a build of `date` costs a guest whose usage row is `row`. */
export function guestScenarioChargeFor(
  row: { generationsCount: number; scenarioDates: string[] | null } | null,
  date: string,
  maxLifetime: number,
): { kind: "free" } | { kind: "charge" } | { kind: "blocked" } {
  if (row?.scenarioDates?.includes(date)) return { kind: "free" };
  if ((row?.generationsCount ?? 0) >= maxLifetime) return { kind: "blocked" };
  return { kind: "charge" };
}

const MAX_ATTEMPTS = 5;

/** Two builds of one guest at once (the weekend starts both dates together) can collide on the usage row. */
export function isQuotaConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
}

/**
 * Charges the first build of a date. A serialization or unique-key conflict with a concurrent build of the same guest
 * retries the WHOLE transaction (the quota is read again against the updated row), so a weekend's two dates both get
 * their answer instead of one failing with a 500.
 */
export async function chargeGuestScenarioDate(key: string, date: string, db: { $transaction: typeof prisma.$transaction } = prisma, maxLifetime: number = guestMaxLifetimeGenerations()): Promise<GuestScenarioCharge> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await chargeOnce(key, date, db, maxLifetime);
    } catch (error) {
      if (!isQuotaConflict(error) || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
    }
  }
}

async function chargeOnce(key: string, date: string, db: { $transaction: typeof prisma.$transaction }, maxLifetime: number): Promise<GuestScenarioCharge> {
  return db.$transaction(
    async (tx: Tx) => {
      const row = await tx.guestUsage.findUnique({ where: { anonymousId: key }, select: { generationsCount: true, scenarioDates: true } });
      const rule = guestScenarioChargeFor(row, date, maxLifetime);
      if (rule.kind === "free") return { ok: true as const, charged: false };
      if (rule.kind === "blocked") return { ok: false as const, reason: "requires_auth" as const };
      if (!row) {
        await tx.guestUsage.create({ data: { anonymousId: key, generationsCount: 1, scenarioDates: [date] } });
      } else {
        await tx.guestUsage.update({ where: { anonymousId: key }, data: { generationsCount: { increment: 1 }, scenarioDates: { push: date } } });
      }
      return { ok: true as const, charged: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 4000, timeout: 8000 },
  );
}
