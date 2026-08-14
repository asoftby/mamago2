import type { MigrationLineage, MigrationTargetType } from "@prisma/client";

export type ImportedTargetUpdateConflictReason =
  | "LINEAGE_MISSING"
  | "LINEAGE_MISMATCH"
  | "TARGET_ID_MISSING"
  | "TARGET_ROW_MISSING"
  | "LAST_IMPORTED_AT_UNKNOWN"
  | "TARGET_MODIFIED_AFTER_IMPORT";

export type ImportedTargetUpdateSafetyClassification =
  | { classification: "UPDATE_SAFE"; targetId: string; lineage: ImportedTargetLineageSlice }
  | {
      classification: "UPDATE_CONFLICT";
      reason: ImportedTargetUpdateConflictReason;
      targetId?: string;
      lineage?: ImportedTargetLineageSlice;
    };

export type ImportedTargetLineageSlice = Pick<
  MigrationLineage,
  "sourceRecordKey" | "targetType" | "targetId" | "lastImportedAt"
> &
  Partial<MigrationLineage>;

export interface ClassifyImportedTargetUpdateSafetyInput {
  targetType: MigrationTargetType;
  sourceRecordKey: string;
  lineage: ImportedTargetLineageSlice | null;
  target: { id: string; updatedAt: Date } | null;
}

/**
 * Shared timestamp gate for Event/Article/Route (and any later entity)
 * UPDATE. Mirrors Place's `classifyPlaceUpdateSafety` decision table:
 * missing/ambiguous lineage, missing target, unknown lastImportedAt, or a
 * target `updatedAt` newer than last import → conflict, never a guessed
 * overwrite of mamaGo-owned fields.
 */
export function classifyImportedTargetUpdateSafety(
  input: ClassifyImportedTargetUpdateSafetyInput,
): ImportedTargetUpdateSafetyClassification {
  const { lineage, target, targetType, sourceRecordKey } = input;

  if (!lineage) {
    return { classification: "UPDATE_CONFLICT", reason: "LINEAGE_MISSING" };
  }
  if (lineage.sourceRecordKey !== sourceRecordKey || lineage.targetType !== targetType) {
    return {
      classification: "UPDATE_CONFLICT",
      reason: "LINEAGE_MISMATCH",
      targetId: lineage.targetId ?? undefined,
      lineage,
    };
  }
  if (!lineage.targetId?.trim()) {
    return { classification: "UPDATE_CONFLICT", reason: "TARGET_ID_MISSING", lineage };
  }
  if (!target) {
    return {
      classification: "UPDATE_CONFLICT",
      reason: "TARGET_ROW_MISSING",
      targetId: lineage.targetId,
      lineage,
    };
  }
  if (!lineage.lastImportedAt) {
    return {
      classification: "UPDATE_CONFLICT",
      reason: "LAST_IMPORTED_AT_UNKNOWN",
      targetId: lineage.targetId,
      lineage,
    };
  }
  if (target.updatedAt.getTime() > lineage.lastImportedAt.getTime()) {
    return {
      classification: "UPDATE_CONFLICT",
      reason: "TARGET_MODIFIED_AFTER_IMPORT",
      targetId: lineage.targetId,
      lineage,
    };
  }
  return { classification: "UPDATE_SAFE", targetId: lineage.targetId, lineage };
}
