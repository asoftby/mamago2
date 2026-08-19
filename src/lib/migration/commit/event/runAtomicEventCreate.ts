import { buildEventCreateDraft } from "./buildEventCreateDraft";
import { EventCommitWriter } from "./EventCommitWriter";
import type { EventCommitWriterPrismaClient } from "./EventCommitWriter";
import type { EventCommitBlockReason, EventCommitContext, NormalizedEventCandidate } from "./types";
import { MigrationLineageWriter } from "../../lineage/MigrationLineageWriter";
import type { CreateLineageInput, CreateLineageResult, MigrationLineageWriterPrismaClient } from "../../lineage/types";

/**
 * Everything `EventCommitWriter` (`Activity`/`ActivitySession`/`EventVenue`)
 * and `MigrationLineageWriter` (`MigrationLineage`) need, structurally
 * satisfied by both the real `PrismaClient` and a Prisma
 * `$transaction((tx) => ...)` callback's `tx` argument — the two share the
 * exact same per-model delegate shape, `tx` just lacks top-level methods
 * (`$connect`, `$transaction` itself, etc.) that neither writer ever calls.
 */
export type EventCreateTransactionClient = EventCommitWriterPrismaClient & MigrationLineageWriterPrismaClient;

export interface RunAtomicEventCreateInput {
  candidate: NormalizedEventCandidate;
  context: EventCommitContext;
  /** Everything `MigrationLineageWriter.createLineage()` needs except `targetId` — that comes from the `Activity` row this function itself creates. */
  lineageInput: Omit<CreateLineageInput, "targetId" | "targetStableKey">;
  now?: () => Date;
}

export type RunAtomicEventCreateResult =
  | { ok: true; activityId: string; lineageResult: CreateLineageResult }
  | { ok: false; reasonCode: "EVENT_CREATE_BLOCKED"; blockReasons: readonly EventCommitBlockReason[] };

/**
 * The atomic core of an Event CREATE: `Activity` + `ActivitySession` +
 * `EventVenue` + `MigrationLineage`, all through one `tx`, so a failure at
 * any step (most importantly the lineage write, whose exact-key unique
 * constraint can legitimately conflict with a deactivated row left by an
 * authorized rollback — see `MigrationLineageWriter`) rolls back everything,
 * never leaving an orphan `Activity` with no lineage tracking it.
 *
 * Only `buildEventCreateDraft()`'s block check returns a typed `{ok:false}`
 * result without throwing — nothing was written yet, there's nothing to
 * roll back. Every I/O failure past that point (writer or lineage) is left
 * to propagate as a thrown exception: the caller is expected to run this
 * function inside `prisma.$transaction(...)`, whose own rollback is the
 * actual safety net, not a try/catch in here.
 *
 * Media sync is deliberately never part of this — network I/O has no
 * business running inside a DB transaction, and `EventCommitRunner` already
 * treats a media failure as non-fatal (a warning, not a blocker) for
 * reasons unrelated to atomicity.
 */
export async function runAtomicEventCreate(
  tx: EventCreateTransactionClient,
  input: RunAtomicEventCreateInput,
): Promise<RunAtomicEventCreateResult> {
  const draftResult = buildEventCreateDraft({ candidate: input.candidate, context: input.context });
  if (!draftResult.ok) {
    return { ok: false, reasonCode: "EVENT_CREATE_BLOCKED", blockReasons: draftResult.reasons };
  }

  const writer = new EventCommitWriter(tx);
  const { activityId } = await writer.createEventFromDraft(draftResult.draft);

  const lineageWriter = new MigrationLineageWriter(tx, input.now);
  const lineageResult = await lineageWriter.createLineage({
    ...input.lineageInput,
    targetId: activityId,
    targetStableKey: activityId,
  });

  return { ok: true, activityId, lineageResult };
}
