import { Prisma, type PrismaClient, type TelegramEnvironment } from "@prisma/client";
import type { PlanOwner } from "@/server/services/planOwner";
import { CAPTURE_LIMITS } from "./captureLimits";
import { CAPTURE_REPLIES } from "./captureReplies";
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
    // Redelivery of an already stored update must exit quietly, even at the rate limit.
    const already = await db.inboxItemPart.findUnique({
      where: {
        environment_telegramUpdateId: { environment, telegramUpdateId: BigInt(capture.updateId) },
      },
      select: { id: true },
    });
    if (already) return { status: "duplicate" };
    if (await isRateLimited(db, owner.userId)) return { status: "rejected", reason: "RATE_LIMITED" };
    const debounceUntil = now();
    try {
      // One statement-level nested create: a duplicate update id fails the
      // whole write, so no orphaned InboxItem can remain.
      const item = await db.inboxItem.create({
        data: {
          ...itemData(owner, environment, capture, debounceUntil, []),
          parts: { create: partData(capture, environment, 0) },
        },
        select: { id: true },
      });
      return { status: "stored", inboxItemId: item.id, debounceUntil, isAlbumPart: false };
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
      });
    } catch (error) {
      if (isUpdateIdConflict(error)) return { status: "duplicate" };
      throw error;
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

  async function numberParts(inboxItemId: string): Promise<void> {
    const parts = await db.inboxItemPart.findMany({
      where: { inboxItemId },
      orderBy: { telegramMessageId: "asc" },
      select: { id: true },
    });
    await db.$transaction(
      parts.map((part, index) => db.inboxItemPart.update({ where: { id: part.id }, data: { position: index } })),
    );
  }

  async function processWhenReady(
    owner: PlanOwner,
    capture: ParsedCapture,
    stored: Extract<IntakeOutcome, { status: "stored" }>,
  ): Promise<void> {
    try {
      if (stored.isAlbumPart) {
        const wait = Math.max(0, stored.debounceUntil.getTime() - now().getTime()) + jitter();
        await sleep(wait);
      }
      if (!(await claim(stored.inboxItemId))) return;

      await numberParts(stored.inboxItemId);
      await notifier.typing(capture.chatId);
      try {
        await processor.process(stored.inboxItemId);
      } catch {
        logCode("PROCESSOR_ERROR", owner.userId);
        await db.inboxItem.updateMany({
          where: { id: stored.inboxItemId, status: "PROCESSING" },
          data: { status: "FAILED", error: "PROCESSOR_ERROR", processedAt: now() },
        });
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
