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
 * lineage semantics don't exist yet (see PR11 scope) — that's a later PR,
 * once the engine actually has an UPDATE path to record lineage for.
 */
export class MigrationLineageWriter {
  constructor(private readonly prisma: MigrationLineageWriterPrismaClient) {}

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
