import { Prisma, type PrismaClient, type TelegramEnvironment } from "@prisma/client";
import type { PlanOwner } from "@/server/services/planOwner";
import { CAPTURE_LIMITS } from "./captureLimits";
import { CAPTURE_PROCESSING_FAILED_TEXT, CAPTURE_REPLIES } from "./captureReplies";
import { numberInboxParts } from "./inboxParts";
import type { InboxProcessor } from "./inboxProcessor";
import type { ParsedCapture } from "./telegramUpdateParser";

/**
 * Intake of forwarded messages / screenshots into InboxItem + InboxItemPart
 * (forward-to-plan spec v1.3, section 6.3). Free of server-only imports so it
 * can run against a scratch database in tests; Telegram I/O is injected.
 *
 * Logging: codes and userId only. Never message text, chat ids, file ids or URLs.
 */
export type IntakeNotifier = {
  /** Best-effort: must never throw. */
  reply(chatId: number, text: string): Promise<void>;
  /** Best-effort typing indicator: must never throw. */
  typing(chatId: number): Promise<void>;
  /** Send one processing status; message id becomes the eventual preview card. */
  progress?(chatId: number, partKind: "TEXT" | "PHOTO"): Promise<number | null>;
  /** Edit the processing status to an error, falling back to a new reply. */
  failed?(chatId: number, messageId: number | null, text: string): Promise<void>;
};

export type InboxIntakeDeps = {
  db: PrismaClient;
  notifier: IntakeNotifier;
  processor: InboxProcessor;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Random extra delay before claiming, in ms. */
  jitter?: () => number;
};

export type RejectReason = "RATE_LIMITED" | "TEXT_TOO_LONG" | "PHOTO_TOO_LARGE" | "UNSUPPORTED";

export type IntakeOutcome =
  | { status: "stored"; inboxItemId: string; debounceUntil: Date; isAlbumPart: boolean }
  | { status: "truncated"; inboxItemId: string }
  | { status: "duplicate" }
  | { status: "rejected"; reason: RejectReason };

export type IntakeResult = {
  outcome: IntakeOutcome;
  /** Run after the HTTP response: waits for the debounce, claims, processes. */
  afterResponse: (() => Promise<void>) | null;
};

type StoreResult = IntakeOutcome;

const REJECT_REPLY: Record<RejectReason, string> = {
  RATE_LIMITED: CAPTURE_REPLIES.rateLimited,
  TEXT_TOO_LONG: CAPTURE_REPLIES.textTooLong,
  PHOTO_TOO_LARGE: CAPTURE_REPLIES.photoTooLarge,
  UNSUPPORTED: CAPTURE_REPLIES.unsupported,
};

function logCode(code: string, userId: string): void {
  console.error(`[inbox-intake] code=${code} userId=${userId}`);
}

function isUpdateIdConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.some((field) => field.includes("telegramUpdateId"));
}

/** Interactive-transaction limits: a receipt may wait behind other updates of the same user. */
const INTAKE_TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

/**
 * Per-user lock that serializes "count the 24h limit + create" so parallel
 * updates cannot overshoot it. Lock order is always user first, then album
 * (media group), in every receipt transaction, so no deadlock is possible.
 */
async function lockUserIntake(
  tx: Prisma.TransactionClient,
  owner: PlanOwner,
  environment: TelegramEnvironment,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${owner.userId}:${environment}`}))`;
}

export function createInboxIntake(deps: InboxIntakeDeps) {
  const { db, notifier, processor } = deps;
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const jitter = deps.jitter ?? (() => Math.floor(Math.random() * CAPTURE_LIMITS.claimJitterMaxMs));

  function validate(capture: ParsedCapture): RejectReason | null {
    if (capture.partKind === "UNSUPPORTED") return "UNSUPPORTED";
    if (capture.text !== null && capture.text.length > CAPTURE_LIMITS.maxTextChars) return "TEXT_TOO_LONG";
    if (capture.partKind === "PHOTO" && (capture.photoTooLarge || !capture.fileId)) return "PHOTO_TOO_LARGE";
    return null;
  }

  async function isRateLimited(client: Pick<PrismaClient, "inboxItem">, userId: string): Promise<boolean> {
    const since = new Date(now().getTime() - CAPTURE_LIMITS.rateWindowMs);
    const count = await client.inboxItem.count({ where: { userId, createdAt: { gte: since } } });
    return count >= CAPTURE_LIMITS.maxItemsPer24h;
  }

  function partData(capture: ParsedCapture, environment: TelegramEnvironment, position: number) {
    return {
      environment,
      telegramUpdateId: BigInt(capture.updateId),
      telegramMessageId: capture.messageId,
      kind: capture.partKind === "PHOTO" ? ("PHOTO" as const) : ("TEXT" as const),
      text: capture.text,
      telegramFileId: capture.partKind === "PHOTO" ? capture.fileId : null,
      position,
    };
  }

  function itemData(
    owner: PlanOwner,
    environment: TelegramEnvironment,
    capture: ParsedCapture,
    debounceUntil: Date,
    ruleCodes: string[],
  ) {
    const createdAt = now();
    return {
      userId: owner.userId,
      environment,
      telegramChatId: BigInt(capture.chatId),
      mediaGroupId: capture.mediaGroupId,
      sourceKind: capture.sourceKind,
      anchorAt: capture.anchorAt,
      anchorIsForward: capture.anchorIsForward,
      debounceUntil,
      ruleCodes,
      createdAt,
      purgeAfter: new Date(createdAt.getTime() + CAPTURE_LIMITS.purgeAfterMs),
    };
  }

  async function storeSingle(
    owner: PlanOwner,
    environment: TelegramEnvironment,
    capture: ParsedCapture,
  ): Promise<StoreResult> {
    const receiptKey = {
      environment_telegramUpdateId: { environment, telegramUpdateId: BigInt(capture.updateId) },
    };

    // Fast path outside the lock: a redelivered update exits quietly without
    // queueing behind the user lock, even at the rate limit.
    if (await db.inboxItemPart.findUnique({ where: receiptKey, select: { id: true } })) {
      return { status: "duplicate" };
    }

    try {
      return await db.$transaction(async (tx) => {
        await lockUserIntake(tx, owner, environment);

        // Re-check under the lock (a concurrent delivery may have committed);
        // the unique index stays the final guard.
        if (await tx.inboxItemPart.findUnique({ where: receiptKey, select: { id: true } })) {
          return { status: "duplicate" } as const;
        }
        if (await isRateLimited(tx, owner.userId)) return { status: "rejected", reason: "RATE_LIMITED" } as const;

        const debounceUntil = now();
        // Nested create in the same transaction: a duplicate update id rolls
        // everything back, so no orphaned InboxItem can remain.
        const item = await tx.inboxItem.create({
          data: {
            ...itemData(owner, environment, capture, debounceUntil, []),
            parts: { create: partData(capture, environment, 0) },
          },
          select: { id: true },
        });
        return { status: "stored", inboxItemId: item.id, debounceUntil, isAlbumPart: false } as const;
      }, INTAKE_TX_OPTIONS);
    } catch (error) {
      if (isUpdateIdConflict(error)) return { status: "duplicate" };
      throw error;
    }
  }

  async function storeAlbumPart(
    owner: PlanOwner,
    environment: TelegramEnvironment,
    capture: ParsedCapture,
    mediaGroupId: string,
  ): Promise<StoreResult> {
    try {
      return await db.$transaction(async (tx) => {
        await lockUserIntake(tx, owner, environment);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${owner.userId}:${environment}:${mediaGroupId}`}))`;

        const already = await tx.inboxItemPart.findUnique({
          where: {
            environment_telegramUpdateId: { environment, telegramUpdateId: BigInt(capture.updateId) },
          },
          select: { id: true },
        });
        if (already) return { status: "duplicate" } as const;

        const debounceUntil = new Date(now().getTime() + CAPTURE_LIMITS.albumDebounceMs);

        const open = await tx.inboxItem.findFirst({
          where: { userId: owner.userId, environment, mediaGroupId, status: "RECEIVED" },
          orderBy: { createdAt: "desc" },
          select: { id: true, ruleCodes: true },
        });

        if (open) {
          if (capture.partKind === "PHOTO") {
            const photos = await tx.inboxItemPart.count({ where: { inboxItemId: open.id, kind: "PHOTO" } });
            if (photos >= CAPTURE_LIMITS.maxPhotosPerItem) {
              if (!open.ruleCodes.includes("ALBUM_TRUNCATED")) {
                await tx.inboxItem.update({
                  where: { id: open.id },
                  data: { ruleCodes: { push: "ALBUM_TRUNCATED" } },
                });
              }
              return { status: "truncated", inboxItemId: open.id } as const;
            }
          }

          // Conditional extend: if a claim won the race in between, the
          // item is no longer RECEIVED and this part starts a new item.
          const extended = await tx.inboxItem.updateMany({
            where: { id: open.id, status: "RECEIVED" },
            data: { debounceUntil },
          });
          if (extended.count === 1) {
            const position = await tx.inboxItemPart.count({ where: { inboxItemId: open.id } });
            await tx.inboxItemPart.create({
              data: { inboxItemId: open.id, ...partData(capture, environment, position) },
            });
            return { status: "stored", inboxItemId: open.id, debounceUntil, isAlbumPart: true } as const;
          }
        }

        if (await isRateLimited(tx, owner.userId)) return { status: "rejected", reason: "RATE_LIMITED" } as const;

        const earlier = await tx.inboxItem.findFirst({
          where: { userId: owner.userId, environment, mediaGroupId },
          select: { id: true },
        });
        const item = await tx.inboxItem.create({
          data: {
            ...itemData(owner, environment, capture, debounceUntil, earlier ? ["ALBUM_LATE_PART"] : []),
            parts: { create: partData(capture, environment, 0) },
          },
          select: { id: true },
        });
        return { status: "stored", inboxItemId: item.id, debounceUntil, isAlbumPart: true } as const;
      }, INTAKE_TX_OPTIONS);
    } catch (error) {
      if (isUpdateIdConflict(error)) return { status: "duplicate" };
      throw error;
    }
  }

  /**
   * Reserve the preview message ID so concurrent album parts do not send
   * duplicate acknowledgements. -1 is a temporary reservation, never sent
   * to Telegram as a message ID. A restart/recovery can still send the card.
   */
  async function announceProgress(inboxItemId: string, capture: ParsedCapture): Promise<void> {
    if (!notifier.progress) return;
    const reserved = await db.inboxItem.updateMany({
      where: { id: inboxItemId, status: "RECEIVED", cardMessageId: null },
      data: { cardMessageId: -1 },
    });
    if (reserved.count !== 1) return;

    try {
      const messageId = await notifier.progress(
        capture.chatId,
        capture.partKind === "PHOTO" ? "PHOTO" : "TEXT",
      );
      if (!messageId || messageId <= 0) throw new Error("STATUS_SEND_FAILED");
      await db.inboxItem.updateMany({
        where: { id: inboxItemId, cardMessageId: -1 },
        data: { cardMessageId: messageId },
      });
    } catch {
      // Keep parsing even if Telegram rejects the progress message.
      // Presenter treats null and -1 as unsent; no id is leaked to logs.
      await db.inboxItem.updateMany({
        where: { id: inboxItemId, cardMessageId: -1 },
        data: { cardMessageId: null },
      });
      console.error("[inbox-intake] code=PROGRESS_SEND_FAILED");
    }
  }

  async function notifyFailed(inboxItemId: string, chatId: number): Promise<void> {
    const item = await db.inboxItem.findUnique({
      where: { id: inboxItemId },
      select: { cardMessageId: true },
    });
    const messageId = item?.cardMessageId && item.cardMessageId > 0
      ? item.cardMessageId
      : null;
    if (notifier.failed) {
      await notifier.failed(chatId, messageId, CAPTURE_PROCESSING_FAILED_TEXT);
    } else {
      await notifier.reply(chatId, CAPTURE_PROCESSING_FAILED_TEXT);
    }
  }

  /** Compare-and-set claim: exactly one caller wins. */
  async function claim(inboxItemId: string): Promise<boolean> {
    const result = await db.inboxItem.updateMany({
      where: { id: inboxItemId, status: "RECEIVED", debounceUntil: { lte: now() } },
      data: { status: "PROCESSING" },
    });
    return result.count === 1;
  }


  async function processWhenReady(
    owner: PlanOwner,
    capture: ParsedCapture,
    stored: Extract<IntakeOutcome, { status: "stored" }>,
  ): Promise<void> {
    try {
      try {
        await announceProgress(stored.inboxItemId, capture);
      } catch {
        console.error("[inbox-intake] code=PROGRESS_UPDATE_FAILED");
      }
      if (stored.isAlbumPart) {
        const wait = Math.max(0, stored.debounceUntil.getTime() - now().getTime()) + jitter();
        await sleep(wait);
      }
      if (!(await claim(stored.inboxItemId))) return;

      await numberInboxParts(db, stored.inboxItemId);
      try {
        await notifier.typing(capture.chatId);
      } catch {
        console.error("[inbox-intake] code=TYPING_SEND_FAILED");
      }
      try {
        await processor.process(stored.inboxItemId);
      } catch {
        logCode("PROCESSOR_ERROR", owner.userId);
        const failed = await db.inboxItem.updateMany({
          where: { id: stored.inboxItemId, status: "PROCESSING" },
          data: { status: "FAILED", error: "PROCESSOR_ERROR", processedAt: now() },
        });
        if (failed.count === 1) await notifyFailed(stored.inboxItemId, capture.chatId);
      }
    } catch {
      logCode("AFTER_RESPONSE_ERROR", owner.userId);
    }
  }

  return {
    /**
     * Stores the update (before the HTTP response) and returns the deferred
     * processing step. Throws only when the database write itself failed, so
     * the caller can answer 500 and let Telegram redeliver (idempotent).
     */
    async receive(
      owner: PlanOwner,
      environment: TelegramEnvironment,
      capture: ParsedCapture,
    ): Promise<IntakeResult> {
      const rejected = validate(capture);
      if (rejected) {
        await notifier.reply(capture.chatId, REJECT_REPLY[rejected]);
        return { outcome: { status: "rejected", reason: rejected }, afterResponse: null };
      }

      const outcome = capture.mediaGroupId
        ? await storeAlbumPart(owner, environment, capture, capture.mediaGroupId)
        : await storeSingle(owner, environment, capture);

      if (outcome.status === "rejected") {
        await notifier.reply(capture.chatId, REJECT_REPLY[outcome.reason]);
        return { outcome, afterResponse: null };
      }
      if (outcome.status !== "stored") return { outcome, afterResponse: null };

      return { outcome, afterResponse: () => processWhenReady(owner, capture, outcome) };
    },

    /** Exposed for tests: the CAS claim used by the deferred step. */
    claim,
  };
}

export type InboxIntake = ReturnType<typeof createInboxIntake>;
