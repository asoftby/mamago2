import type {
  MigrationRecord,
  MigrationRun,
  MigrationRunMode,
  MigrationRunStatus,
  MigrationSource,
  PrismaClient,
} from "@prisma/client";

import type { MigrationPlan, MigrationPlanStats } from "../types";

/**
 * The narrowest slice of `PrismaClient` this writer needs — three write
 * delegates (`upsert`/`create`/`update` only, never `article`/`place`/
 * `migrationLineage`/`migrationReviewTask`/media/redirect delegates, which
 * aren't even present on this type) plus an optional batch `$transaction`.
 * Structurally, a fake test double only needs to implement these methods;
 * the real `prisma` singleton satisfies this trivially.
 */
export interface MigrationRunWriterPrismaClient {
  migrationSource: Pick<PrismaClient["migrationSource"], "upsert">;
  migrationRun: Pick<PrismaClient["migrationRun"], "create" | "update">;
  migrationRecord: Pick<PrismaClient["migrationRecord"], "create">;
  /**
   * Optional, and deliberately a simple hand-written batch-array signature
   * rather than Prisma's full overloaded `$transaction` type — so a fake
   * test client can implement it with a one-line `Promise.all`, no need to
   * emulate Prisma's interactive-transaction machinery. The real
   * `prisma.$transaction` satisfies this signature as-is.
   */
  $transaction?: <T>(operations: readonly PromiseLike<T>[]) => Promise<T[]>;
}

export interface UpsertSourceInput {
  adapterKey: string;
  sourceNamespace: string;
  sourceLabel?: string;
}

export interface CreateRunInput {
  sourceId: string;
  mode: MigrationRunMode;
  adapterVersion?: string;
  triggerType?: string;
  triggerUserId?: string | null;
  stats?: MigrationPlanStats;
}

export interface CreateRecordsFromPlanInput {
  sourceId: string;
  runId: string;
  plan: MigrationPlan;
}

export interface FinishRunInput {
  runId: string;
  status: Extract<MigrationRunStatus, "COMPLETED" | "FAILED">;
  stats?: MigrationPlanStats;
  errorMessage?: string;
}

export interface PersistPlanInput {
  adapterKey: string;
  sourceNamespace: string;
  sourceLabel?: string;
  adapterVersion?: string;
  plan: MigrationPlan;
  mode?: Extract<MigrationRunMode, "DRY_RUN">;
}

export interface PersistPlanResult {
  source: MigrationSource;
  run: MigrationRun;
  records: readonly MigrationRecord[];
}

export type { MigrationRecord, MigrationRun, MigrationRunMode, MigrationRunStatus, MigrationSource };
