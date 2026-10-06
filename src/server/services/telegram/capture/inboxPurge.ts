import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * Inbox retention (forward-to-plan spec v1.3, sections 11 and 13):
 *  1. every InboxItem with purgeAfter <= now (ANY status) loses the stored
 *     message text (InboxItemPart.text) and the parsed draft (InboxItem.draft);
 *  2. InboxItems older than 30 days are deleted (parts go by cascade).
 * Idempotent, batched. Returns counts only: content never reaches logs.
 */
export const INBOX_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type InboxPurgeResult = {
  itemsScrubbed: number;
  partsScrubbed: number;
  draftsCleared: number;
  itemsDeleted: number;
  batches: number;
  /** True when the batch cap was hit and more work may remain for the next run. */
  truncated: boolean;
};

export type InboxPurgeDeps = {
  db: Pick<PrismaClient, "inboxItem" | "inboxItemPart" | "$transaction">;
  now?: () => Date;
  batchSize?: number;
  maxBatches?: number;
};

export async function purgeInbox(deps: InboxPurgeDeps): Promise<InboxPurgeResult> {
  const { db } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const batchSize = deps.batchSize ?? 200;
  const maxBatches = deps.maxBatches ?? 50;

  const result: InboxPurgeResult = {
    itemsScrubbed: 0,
    partsScrubbed: 0,
    draftsCleared: 0,
    itemsDeleted: 0,
    batches: 0,
    truncated: false,
  };

  // 1. Scrub expired items (any status).
  for (;;) {
    if (result.batches >= maxBatches) {
      result.truncated = true;
      break;
    }
    const rows = await db.inboxItem.findMany({
      where: {
        purgeAfter: { lte: now },
        OR: [{ draft: { not: Prisma.DbNull } }, { parts: { some: { text: { not: null } } } }],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });
    if (rows.length === 0) break;
    const ids = rows.map((row) => row.id);
    const [parts, drafts] = await db.$transaction([
      db.inboxItemPart.updateMany({ where: { inboxItemId: { in: ids }, text: { not: null } }, data: { text: null } }),
      db.inboxItem.updateMany({ where: { id: { in: ids }, draft: { not: Prisma.DbNull } }, data: { draft: Prisma.DbNull } }),
    ]);
    result.itemsScrubbed += ids.length;
    result.partsScrubbed += parts.count;
    result.draftsCleared += drafts.count;
    result.batches += 1;
  }

  // 2. Delete items past the retention window.
  const cutoff = new Date(now.getTime() - INBOX_RETENTION_DAYS * DAY_MS);
  for (;;) {
    if (result.batches >= maxBatches) {
      result.truncated = true;
      break;
    }
    const rows = await db.inboxItem.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: batchSize,
    });
    if (rows.length === 0) break;
    const deleted = await db.inboxItem.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    result.itemsDeleted += deleted.count;
    result.batches += 1;
  }

  return result;
}
