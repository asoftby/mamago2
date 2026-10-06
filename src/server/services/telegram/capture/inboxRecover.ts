import type { PrismaClient } from "@prisma/client";
import { numberInboxParts } from "./inboxParts";
import type { InboxProcessor } from "./inboxProcessor";

/**
 * Safety net for the after-response processing (forward-to-plan spec v1.3,
 * section 11): picks up InboxItems stuck in RECEIVED for more than two
 * minutes, or in PROCESSING for more than five, and runs the normal processor
 * on them again. A PROCESSING item gets the longer threshold because a healthy
 * run (several model calls, up to ~3 minutes) must not be restarted in parallel.
 *
 *  - Only compare-and-set transitions: a recovery claims an item by moving its
 *    `debounceUntil` (last-activity marker) forward, so concurrent runs cannot
 *    both win it; terminal statuses are never touched.
 *  - Bounded: at most `maxItemsPerRun` items and `deadlineMs` per run, and at
 *    most `maxAttempts` recoveries per item (counted in ruleCodes). An item that
 *    cannot be processed ends as FAILED with a machine code.
 *  - Reports counts only; never logs message content.
 */
export const RECOVER_STALE_AFTER_RECEIVED_MS = 2 * 60 * 1000;
export const RECOVER_STALE_AFTER_PROCESSING_MS = 5 * 60 * 1000;
export const RECOVER_MAX_ITEMS_PER_RUN = 5;
export const RECOVER_MAX_ATTEMPTS = 3;
/** No new item is started after this; the runner's curl limit is 240 s and one item can take ~3 min worst case. */
export const RECOVER_DEADLINE_MS = 45_000;
export const RECOVER_ATTEMPT_CODE = "RECOVER_ATTEMPT";

export type InboxRecoverResult = {
  candidates: number;
  recovered: number;
  failed: number;
  skipped: number;
  deadlineHit: boolean;
};

export type InboxRecoverDeps = {
  db: Pick<PrismaClient, "inboxItem" | "inboxItemPart" | "$transaction">;
  processor: InboxProcessor;
  now?: () => Date;
  staleAfterReceivedMs?: number;
  staleAfterProcessingMs?: number;
  maxItemsPerRun?: number;
  maxAttempts?: number;
  deadlineMs?: number;
};

export async function recoverInbox(deps: InboxRecoverDeps): Promise<InboxRecoverResult> {
  const { db, processor } = deps;
  const now = deps.now ?? (() => new Date());
  const staleAfterReceivedMs = deps.staleAfterReceivedMs ?? RECOVER_STALE_AFTER_RECEIVED_MS;
  const staleAfterProcessingMs = deps.staleAfterProcessingMs ?? RECOVER_STALE_AFTER_PROCESSING_MS;
  const maxItems = deps.maxItemsPerRun ?? RECOVER_MAX_ITEMS_PER_RUN;
  const maxAttempts = deps.maxAttempts ?? RECOVER_MAX_ATTEMPTS;
  const deadlineMs = deps.deadlineMs ?? RECOVER_DEADLINE_MS;

  const startedAt = now().getTime();
  const staleBefore = {
    RECEIVED: new Date(startedAt - staleAfterReceivedMs),
    PROCESSING: new Date(startedAt - staleAfterProcessingMs),
  } as const;

  const candidates = await db.inboxItem.findMany({
    where: {
      OR: [
        { status: "RECEIVED", debounceUntil: { lte: staleBefore.RECEIVED } },
        { status: "PROCESSING", debounceUntil: { lte: staleBefore.PROCESSING } },
      ],
    },
    select: { id: true, status: true, ruleCodes: true },
    orderBy: { createdAt: "asc" },
    take: maxItems,
  });

  const result: InboxRecoverResult = { candidates: candidates.length, recovered: 0, failed: 0, skipped: 0, deadlineHit: false };

  for (const candidate of candidates) {
    if (now().getTime() - startedAt > deadlineMs) {
      result.deadlineHit = true;
      break;
    }

    const attempts = candidate.ruleCodes.filter((code) => code === RECOVER_ATTEMPT_CODE).length;
    if (attempts >= maxAttempts) {
      const exhausted = await db.inboxItem.updateMany({
        where: { id: candidate.id, status: { in: ["RECEIVED", "PROCESSING"] } },
        data: { status: "FAILED", error: "RECOVER_EXHAUSTED", processedAt: now() },
      });
      if (exhausted.count === 1) result.failed += 1;
      else result.skipped += 1;
      continue;
    }

    const threshold = candidate.status === "RECEIVED" ? staleBefore.RECEIVED : staleBefore.PROCESSING;

    // Claim: the stale predicate is re-checked, and moving debounceUntil makes
    // the same predicate false for any concurrent runner.
    const claimed = await db.inboxItem.updateMany({
      where: { id: candidate.id, status: candidate.status, debounceUntil: { lte: threshold } },
      data: { status: "PROCESSING", debounceUntil: now(), ruleCodes: { push: RECOVER_ATTEMPT_CODE } },
    });
    if (claimed.count !== 1) {
      result.skipped += 1;
      continue;
    }

    try {
      await numberInboxParts(db, candidate.id);
      await processor.process(candidate.id);
      result.recovered += 1;
    } catch {
      console.error(`[inbox-recover] code=PROCESSOR_ERROR inboxItemId=${candidate.id}`);
      await db.inboxItem.updateMany({
        where: { id: candidate.id, status: "PROCESSING" },
        data: { status: "FAILED", error: "PROCESSOR_ERROR", processedAt: now() },
      });
      result.failed += 1;
    }
  }

  return result;
}
