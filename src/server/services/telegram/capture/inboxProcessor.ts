import type { PrismaClient } from "@prisma/client";

/**
 * Seam for the parsing stage (PR3). PR2 only hands an InboxItem that has been
 * claimed (status PROCESSING) to a processor.
 */
export type InboxProcessor = {
  process(inboxItemId: string): Promise<void>;
};

/** PR2 default: nothing parses yet, so the item is failed quietly (no user message). */
export function createNotImplementedInboxProcessor(
  db: Pick<PrismaClient, "inboxItem">,
  now: () => Date = () => new Date(),
): InboxProcessor {
  return {
    async process(inboxItemId) {
      await db.inboxItem.updateMany({
        where: { id: inboxItemId, status: "PROCESSING" },
        data: { status: "FAILED", error: "PROCESSOR_NOT_IMPLEMENTED", processedAt: now() },
      });
    },
  };
}
