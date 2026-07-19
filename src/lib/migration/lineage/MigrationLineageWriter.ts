import type { CreateLineageInput, CreateLineageResult, MigrationLineageWriterPrismaClient } from "./types";

const DEFAULT_TARGET_ROLE = "primary";

function assertInputIsUsable(input: CreateLineageInput): void {
  if (!input.sourceId?.trim()) {
    throw new Error("CreateLineageInput.sourceId is required.");
  }
  if (!input.sourceRecordKey?.trim()) {
    throw new Error("CreateLineageInput.sourceRecordKey is required.");
  }
  if (!input.targetType) {
    throw new Error("CreateLineageInput.targetType is required.");
  }
  if (!input.targetId?.trim()) {
    throw new Error("CreateLineageInput.targetId is required.");
  }
  if (!input.lastSourceHash?.trim()) {
    throw new Error("CreateLineageInput.lastSourceHash is required.");
  }
}

/**
 * Records lineage after a successful entity CREATE.
 *
 * `MigrationLineage` is a durable *mapping*, not a log of every attempt
 * (`MigrationRecord` is the log) — the full, non-partial unique index
 * (`sourceId` + `sourceRecordKey` + `targetType` + `targetRole`) says
 * exactly that: at most one row can ever exist for a given key, active or
 * not. A row can be `isActive: false` — e.g. left behind by an explicitly
 * authorized rollback that deactivated rather than deleted it, to preserve
 * migration audit history (see prelaunch-checklist.md) — and a legitimate
 * re-CREATE for that same source key must reactivate that row in place,
 * since a plain `.create()` retry can never succeed there again.
 *
 * This never issues a statement expected to fail as part of normal control
 * flow. That matters because `createLineage()` can run inside a Prisma
 * interactive transaction (`runAtomicEventCreate`), and in PostgreSQL a
 * failed statement aborts the *whole* surrounding transaction — every
 * later statement on that same connection fails too, "current transaction
 * is aborted." An earlier version of this class tried `create()` first and
 * reactivated on catching the resulting `P2002` — which is exactly the
 * catch-then-retry-on-the-same-connection pattern that breaks once this
 * runs inside a transaction: the `updateMany()` retry would itself fail
 * against an already-aborted transaction, so the reactivation this class
 * exists for could never actually succeed there. Fixed by never
 * speculatively creating: reactivation is attempted first, with no prior
 * failing statement.
 *
 * 1. Attempt reactivation: a single `updateMany()` guarded by
 *    `isActive: false` in its own `where` (not a read-then-write). If it
 *    updates exactly one row, that row is fetched by the same unique key
 *    and returned — same lineage `id`, never a second row.
 * 2. If it updates zero rows, read the exact key with `findUnique()` to
 *    find out why: an existing *active* row throws a deterministic
 *    conflict (never silently overwritten by a CREATE — the original
 *    failure mode this class exists to catch, e.g. a real double-run of
 *    the same commit operation). No row at all falls through to `create()`
 *    — the ordinary case.
 * 3. `create()` is the only statement ever attempted after a read already
 *    confirmed no row exists, so it's never expected to fail — but a
 *    genuine concurrent insert winning the exact same race would still
 *    throw `P2002` here, and that failure is deliberately left to
 *    propagate rather than retried: the caller's own transaction (if any)
 *    rolls back cleanly instead of this class issuing another statement on
 *    an already-aborted connection.
 *
 * `lastImportedAt` is stamped with `now()` on both create and reactivate —
 * the one field a later targeted-UPDATE safety check (see
 * `PlaceCommitRunner`) relies on to prove "we know when this was last
 * imported," so it must never be left `null`/stale. `now` is injectable
 * (defaults to the real clock) purely so tests can assert an exact value.
 *
 * No real-Postgres integration harness exists in this repo yet to prove
 * transaction-abort recovery end-to-end (checked: no testcontainers/pg-mem/
 * disposable-DB setup anywhere under `src/lib/migration`) — the guarantee
 * here is structural instead: reactivation is attempted with zero prior
 * statements in this call, so there is no failed statement for a real
 * Postgres transaction to have aborted on by the time `updateMany()` runs.
 */
export class MigrationLineageWriter {
  constructor(
    private readonly prisma: MigrationLineageWriterPrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createLineage(input: CreateLineageInput): Promise<CreateLineageResult> {
    assertInputIsUsable(input);
    const targetRole = input.targetRole ?? DEFAULT_TARGET_ROLE;
    const exactKey = {
      sourceId: input.sourceId,
      sourceRecordKey: input.sourceRecordKey,
      targetType: input.targetType,
      targetRole,
    };

    const reactivated = await this.prisma.migrationLineage.updateMany({
      where: { ...exactKey, isActive: false },
      data: {
        targetId: input.targetId,
        targetNaturalKey: input.targetStableKey ?? null,
        lastSourceHash: input.lastSourceHash,
        runId: input.runId ?? null,
        recordId: input.recordId ?? null,
        isActive: true,
        lastImportedAt: this.now(),
      },
    });

    if (reactivated.count === 1) {
      const row = await this.prisma.migrationLineage.findUniqueOrThrow({
        where: { sourceId_sourceRecordKey_targetType_targetRole: exactKey },
      });
      return {
        lineageId: row.id,
        sourceRecordKey: input.sourceRecordKey,
        targetType: input.targetType,
        targetId: input.targetId,
      };
    }

    const existing = await this.prisma.migrationLineage.findUnique({
      where: { sourceId_sourceRecordKey_targetType_targetRole: exactKey },
    });

    if (existing) {
      throw new Error(
        `MigrationLineage already has an active row for sourceId=${input.sourceId} ` +
          `sourceRecordKey=${input.sourceRecordKey} targetType=${input.targetType} ` +
          `targetRole=${targetRole} — refusing to overwrite an active mapping.`,
      );
    }

    const lineage = await this.prisma.migrationLineage.create({
      data: {
        sourceId: input.sourceId,
        sourceEntityType: input.sourceEntityType,
        sourceStableKey: input.sourceStableKey,
        sourceRecordKey: input.sourceRecordKey,
        targetType: input.targetType,
        targetRole,
        targetId: input.targetId,
        targetNaturalKey: input.targetStableKey ?? null,
        lastSourceHash: input.lastSourceHash,
        runId: input.runId ?? null,
        recordId: input.recordId ?? null,
        isActive: true,
        lastImportedAt: this.now(),
      },
    });

    return {
      lineageId: lineage.id,
      sourceRecordKey: input.sourceRecordKey,
      targetType: input.targetType,
      targetId: input.targetId,
    };
  }
}
