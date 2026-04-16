import { cache } from "react";
import prisma from "@/lib/prisma";
import { getModerationNavCounts } from "@/lib/admin/getModerationNavCounts";
import { getB2bPendingVerificationCount } from "@/lib/admin/getB2bPendingVerificationCount";
import type { ModerationNavCounts } from "@/lib/admin/moderationSidebarConfig";

export type AdminNavCounts = {
  moderationCounts: ModerationNavCounts;
  b2bPendingVerificationCount: number;
  importPendingReviewCount: number;
};

const EMPTY_MODERATION_COUNTS: ModerationNavCounts = {
  queueTotal: 0,
  places: 0,
  events: 0,
  offers: 0,
};

/**
 * Один набор запросов на запрос админки; `cache()` дедуплицирует чтение в header и sidebar.
 */
export const loadAdminNavCounts = cache(async (): Promise<AdminNavCounts> => {
  try {
    const [moderationCounts, b2bPendingVerificationCount, importPendingReviewCount] =
      await Promise.all([
        getModerationNavCounts(),
        getB2bPendingVerificationCount(),
        prisma.importReviewTask.count({ where: { status: "PENDING" } }),
      ]);
    return { moderationCounts, b2bPendingVerificationCount, importPendingReviewCount };
  } catch (e) {
    console.error("admin nav counts failed:", e);
    return {
      moderationCounts: EMPTY_MODERATION_COUNTS,
      b2bPendingVerificationCount: 0,
      importPendingReviewCount: 0,
    };
  }
});
