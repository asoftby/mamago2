import type {
  MigrationLineage,
  MigrationRun,
  MigrationSource,
  MigrationTargetType,
  PrismaClient,
} from "@prisma/client";

import type { MigrationPlanAction } from "../types";

/**
 * The narrowest slice of `PrismaClient` this repository needs — just the
 * three delegate methods actually called, each typed via Prisma's own
 * generated signatures (so query shapes are never hand-duplicated). The
 * real `prisma` singleton satisfies this structurally; tests can supply a
 * plain object implementing only these three methods, no full mock needed.
 */
export interface MigrationLedgerPrismaClient {
  migrationSource: Pick<PrismaClient["migrationSource"], "findUnique">;
  migrationRun: Pick<PrismaClient["migrationRun"], "findFirst">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
}

export interface FindLineageBySourceRecordKeysInput {
  adapterKey: string;
  sourceNamespace: string;
  keys: readonly string[];
  targetType?: MigrationTargetType;
  targetRole?: string | null;
}

/**
 * `Map<sourceRecordKey, lineage[]>`, not a single lineage per key — one
 * source record can legitimately produce more than one target/lineage row
 * (different `targetType`/`targetRole`, e.g. a place plus its cover media),
 * so collapsing to a single row per key would silently drop data.
 */
export type LineageMap = ReadonlyMap<string, readonly MigrationLineage[]>;

export interface GetLineageActionForRecordInput {
  lineage: readonly MigrationLineage[] | undefined;
  targetType: MigrationTargetType;
  sourceHash: string;
}

/**
 * Reuses the engine's own `MigrationPlanAction` (from `../types`, already
 * consumed by `core/orchestrator.ts`) rather than Prisma's identically-named
 * enum, narrowed to what this PR actually decides — so PR6.5 can feed this
 * straight into a `MigrationPlanItem.action` with no casting.
 */
export type LineageAction = Extract<MigrationPlanAction, "CREATE" | "UPDATE" | "SKIP_UNCHANGED">;

export type { MigrationLineage, MigrationRun, MigrationSource, MigrationTargetType };
