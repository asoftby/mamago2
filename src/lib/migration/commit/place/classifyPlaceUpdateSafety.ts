import type { MigrationLineage, Place, PrismaClient } from "@prisma/client";

export type PlaceUpdateConflictReason =
  | "LINEAGE_MISSING"
  | "LINEAGE_MISMATCH"
  | "TARGET_ID_MISSING"
  | "TARGET_ROW_MISSING"
  | "LAST_IMPORTED_AT_UNKNOWN"
  | "TARGET_MODIFIED_AFTER_IMPORT";

export type PlaceUpdateSafetyClassification =
  | { classification: "UPDATE_SAFE"; targetId: string; lineage: MigrationLineage }
  | {
      classification: "UPDATE_CONFLICT";
      reason: PlaceUpdateConflictReason;
      targetId?: string;
      lineage?: MigrationLineage;
    };

export interface PlaceUpdateSafetyPrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
  place: Pick<PrismaClient["place"], "findUnique">;
}

export interface ClassifyPlaceUpdateSafetyInput {
  prisma: PlaceUpdateSafetyPrismaClient;
  sourceId: string;
  sourceRecordKey: string;
}

/**
 * Read-only UPDATE gate shared by Place preview and commit runner. It only
 * reads the active lineage row and target Place timestamp; it never writes
 * MigrationRecord, MigrationLineage, Place, or media rows.
 */
export async function classifyPlaceUpdateSafety(
  input: ClassifyPlaceUpdateSafetyInput,
): Promise<PlaceUpdateSafetyClassification> {
  const lineage: MigrationLineage | null = await input.prisma.migrationLineage.findFirst({
    where: {
      sourceId: input.sourceId,
      sourceRecordKey: input.sourceRecordKey,
      targetType: "PLACE",
      isActive: true,
    },
  });

  if (!lineage) {
    return { classification: "UPDATE_CONFLICT", reason: "LINEAGE_MISSING" };
  }
  if (lineage.sourceRecordKey !== input.sourceRecordKey || lineage.targetType !== "PLACE") {
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

  const targetPlace: Place | null = await input.prisma.place.findUnique({
    where: { id: lineage.targetId },
  });
  if (!targetPlace) {
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

  if (targetPlace.updatedAt.getTime() > lineage.lastImportedAt.getTime()) {
    return {
      classification: "UPDATE_CONFLICT",
      reason: "TARGET_MODIFIED_AFTER_IMPORT",
      targetId: lineage.targetId,
      lineage,
    };
  }

  return { classification: "UPDATE_SAFE", targetId: lineage.targetId, lineage };
}
