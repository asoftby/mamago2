import type { CreateLineageInput, CreateLineageResult, MigrationLineageWriterPrismaClient } from "./types";

const DEFAULT_TARGET_ROLE = "primary";

/**
 * Postgres unique-violation, surfaced by Prisma as error code `P2002` — see
 * https://www.prisma.io/docs/orm/reference/error-reference#p2002. Checked by
 * duck-typing the `code` property rather than `instanceof
 * Prisma.PrismaClientKnownRequestError`: that class's constructor isn't
 * meant to be called outside Prisma's own client internals (its shape has
 * changed across Prisma versions), so tests can't cheaply construct a real
 * instance — `code` is the one stable, documented contract callers rely on.
 */
function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

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
 * The common case — no row yet at this exact key — is one
 * `migrationLineage.create()` call, unchanged from the original PR11
 * design: `lastSourceHash` is taken exactly as given by the caller
 * (originally `SourceRecordEnvelope.sourceHash`, carried through
 * `MigrationRecord`), never computed or re-derived here; UPDATE lineage
 * semantics for an *active* mapping are still handled inline in each
 * `XCommitRunner` (Place/Route/Article/Event), not here.
 *
 * The one case this now also handles: the exact unique key
 * (`sourceId` + `sourceRecordKey` + `targetType` + `targetRole`) already
 * has a row, but it's `isActive: false` — e.g. left behind by an
 * explicitly authorized rollback that deactivated rather than deleted the
 * row, to preserve migration audit history (see prelaunch-checklist.md).
 * `MigrationLineage` is a durable *mapping*, not a log of every attempt
 * (`MigrationRecord` is the log) — the full, non-partial unique index says
 * exactly that: at most one row can ever exist for a given key, active or
 * not. So a plain `.create()` retry there was never going to work again,
 * ever, for that source key — reactivating the existing row in place is
 * the only way a legitimate re-CREATE after a rollback can succeed.
 *
 * This is race-safe: reactivation is a single `updateMany()` guarded by
 * `isActive: false` in its own `where`, not a read-then-write. If a
 * concurrent process already reactivated the same row between our failed
 * `.create()` and this `updateMany()`, the guard condition no longer
 * matches, `count` comes back `0`, and this throws instead of silently
 * overwriting a target another process just set — never a second reader
 * winning and clobbering the first. If the existing row is *active* at
 * the time of the conflict — a real double-run of the same commit
 * operation, the original failure mode this class was built to catch —
 * this still throws, exactly as before: an active mapping is never
 * silently overwritten by a CREATE.
 *
 * `lastImportedAt` is stamped with `now()` on both create and reactivate —
 * the one field a later targeted-UPDATE safety check (see
 * `PlaceCommitRunner`) relies on to prove "we know when this was last
 * imported," so it must never be left `null`/stale. `now` is injectable
 * (defaults to the real clock) purely so tests can assert an exact value.
 */
export class MigrationLineageWriter {
  constructor(
    private readonly prisma: MigrationLineageWriterPrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createLineage(input: CreateLineageInput): Promise<CreateLineageResult> {
    assertInputIsUsable(input);
    const targetRole = input.targetRole ?? DEFAULT_TARGET_ROLE;

    try {
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
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      return this.reactivateInactiveRow(input, targetRole);
    }
  }

  private async reactivateInactiveRow(
    input: CreateLineageInput,
    targetRole: string,
  ): Promise<CreateLineageResult> {
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

    if (reactivated.count === 0) {
      throw new Error(
        `MigrationLineage already has an active row for sourceId=${input.sourceId} ` +
          `sourceRecordKey=${input.sourceRecordKey} targetType=${input.targetType} ` +
          `targetRole=${targetRole} — refusing to overwrite an active mapping.`,
      );
    }

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
}
