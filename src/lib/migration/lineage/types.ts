import type { MigrationLineage, MigrationTargetType, PrismaClient } from "@prisma/client";

/**
 * The narrowest slice of `PrismaClient` this writer needs — `create` only.
 * No `upsert`, no `update`, no `findUnique`/`findFirst` — this writer must
 * be structurally incapable of doing anything but a single insert (see
 * PR11 scope: UPDATE/upsert lineage semantics don't exist yet, so this
 * type doesn't pretend they do).
 */
export interface MigrationLineageWriterPrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "create">;
}

/**
 * `sourceEntityType` and `sourceStableKey` are required, non-nullable
 * columns on the real `MigrationLineage` model (verified against
 * `prisma/schema.prisma` before writing this file) — they weren't in the
 * originally sketched shape, but omitting them would fail to compile
 * against Prisma's generated `MigrationLineageCreateInput`, not just be a
 * style gap. `targetStableKey` maps onto the real
 * `MigrationLineage.targetNaturalKey` column — there is no
 * `targetStableKey` column in the schema.
 */
export interface CreateLineageInput {
  sourceId: string;
  sourceEntityType: string;
  sourceStableKey: string;
  sourceRecordKey: string;
  targetType: MigrationTargetType;
  /** Defaults to `"primary"`, matching the column's own `@default("primary")`. */
  targetRole?: string;
  targetId: string;
  targetStableKey?: string | null;
  /** Taken as-is from `MigrationRecord.sourceHash`/`SourceRecordEnvelope.sourceHash` — never computed here. */
  lastSourceHash: string;
  runId?: string | null;
  recordId?: string | null;
}

export interface CreateLineageResult {
  lineageId: string;
  sourceRecordKey: string;
  targetType: MigrationTargetType;
  targetId: string;
}

export type { MigrationLineage, MigrationTargetType };
