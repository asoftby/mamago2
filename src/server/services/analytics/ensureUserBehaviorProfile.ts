import type { Prisma, UserBehaviorProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[behavior-profile]";

export type EnsureUserBehaviorProfileOptions = {
  /** Откуда вызван ensure (маршрут, сервис) — без PII */
  source?: string;
};

/**
 * Централизованные дефолты для первичного создания профиля поведения.
 * Должны совпадать со смыслом @default в Prisma schema.
 */
export function buildDefaultUserBehaviorProfileCreateData(
  userId: string,
  now: Date,
): Prisma.UserBehaviorProfileCreateInput {
  return {
    userId,
    totalViews: 0,
    totalOpens: 0,
    totalSaves: 0,
    totalPlanAdds: 0,
    totalCtaClicks: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    weekendShare: 0,
    sameDayPlanningShare: 0,
    advancePlanningShare: 0,
    segmentKeys: [],
  };
}

/**
 * Атомарное get-or-create для UserBehaviorProfile (без гонки INSERT).
 * Использовать для bootstrap / init, когда нужен только факт существования строки.
 */
export async function ensureUserBehaviorProfile(
  userId: string,
  options: EnsureUserBehaviorProfileOptions = {},
): Promise<UserBehaviorProfile> {
  const { source = "unknown" } = options;
  const now = new Date();
  const verbose = process.env.NODE_ENV !== "production";

  if (verbose) {
    console.log(`${LOG_PREFIX} ensure:start`, { userId, source });
  }

  try {
    const row = await prisma.userBehaviorProfile.upsert({
      where: { userId },
      create: buildDefaultUserBehaviorProfileCreateData(userId, now),
      update: { lastSeenAt: now },
    });

    if (verbose) {
      console.log(`${LOG_PREFIX} ensure:done`, {
        userId,
        source,
        mode: "upsert",
      });
    }

    return row;
  } catch (e) {
    console.error(`${LOG_PREFIX} ensure:error`, { userId, source }, e);
    throw e;
  }
}

/** Алиас для поиска по коду (`getOrCreate*` vs `ensure*`). */
export const getOrCreateUserBehaviorProfile = ensureUserBehaviorProfile;
