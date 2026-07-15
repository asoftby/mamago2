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
 * Records lineage after a successful entity CREATE. One
 * `migrationLineage.create()` call — nothing else. No upsert, no
 * find-then-update: a unique-constraint violation
 * (`@@unique([sourceId, sourceRecordKey, targetType, targetRole])`) means
 * the same commit operation ran twice, which is an orchestration bug that
 * should surface immediately, not get silently absorbed by an upsert.
 * `lastSourceHash` is taken exactly as given by the caller (originally
 * `SourceRecordEnvelope.sourceHash`, carried through `MigrationRecord`) —
 * this writer never computes, re-derives, or touches a hash itself. UPDATE
 * lineage semantics are handled inline in each `XCommitRunner` (Place/Route/
 * Article/Event), not here — this class only ever creates.
 *
 * `lastImportedAt` is stamped with `now()` on every successful create — this
 * is the one field a later targeted-UPDATE safety check (see
 * `PlaceCommitRunner`) relies on to prove "we know when this was last
 * imported," so it must never be left `null` by the CREATE path. `now` is
 * injectable (defaults to the real clock) purely so tests can assert an
 * exact value instead of "some `Date` close to `Date.now()`."
 */
export class MigrationLineageWriter {
  constructor(
    private readonly prisma: MigrationLineageWriterPrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createLineage(input: CreateLineageInput): Promise<CreateLineageResult> {
    assertInputIsUsable(input);

    const lineage = await this.prisma.migrationLineage.create({
      data: {
        sourceId: input.sourceId,
        sourceEntityType: input.sourceEntityType,
        sourceStableKey: input.sourceStableKey,
        sourceRecordKey: input.sourceRecordKey,
        targetType: input.targetType,
        targetRole: input.targetRole ?? DEFAULT_TARGET_ROLE,
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
