import { createHash } from "node:crypto";
import { Prisma, type DayScenario } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FingerprintSource = { id: string; startsAt: Date | null };

/**
 * Cheap deterministic signature of a PlanItem set: detects added/removed
 * items and startsAt changes, order-independent. Not a general version
 * hash — just enough to answer "does My Plan still match what the
 * Scenario was built from".
 */
export function computePlanFingerprint(items: FingerprintSource[]): string {
  const parts = items
    .map((item) => `${item.id}:${item.startsAt ? item.startsAt.toISOString() : ""}`)
    .sort();
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

export function getDayScenario(userId: string, date: string): Promise<DayScenario | null> {
  return prisma.dayScenario.findUnique({ where: { userId_date: { userId, date } } });
}

/**
 * Idempotent get-or-create, scoped to the authenticated user. Never creates
 * a second row for the same user/date (DB-unique-constraint-enforced), and
 * never overwrites an already-existing Scenario's fingerprint — creation
 * only ever happens once per user/date.
 */
export async function ensureDayScenario(
  userId: string,
  date: string,
  items: FingerprintSource[],
): Promise<DayScenario> {
  const existing = await getDayScenario(userId, date);
  if (existing) return existing;

  try {
    return await prisma.dayScenario.create({
      data: { userId, date, planFingerprint: computePlanFingerprint(items) },
    });
  } catch (error) {
    // Race safety net: a concurrent duplicate request created it first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const scenario = await getDayScenario(userId, date);
      if (scenario) return scenario;
    }
    throw error;
  }
}

/**
 * Recomputes the fingerprint from the current PlanItem set and stores it —
 * the "Обновить сценарий" action. No-op (returns null) if no Scenario
 * exists yet for this user/date.
 */
export async function refreshDayScenario(
  userId: string,
  date: string,
  items: FingerprintSource[],
): Promise<DayScenario | null> {
  const existing = await getDayScenario(userId, date);
  if (!existing) return null;

  return prisma.dayScenario.update({
    where: { userId_date: { userId, date } },
    data: { planFingerprint: computePlanFingerprint(items) },
  });
}
