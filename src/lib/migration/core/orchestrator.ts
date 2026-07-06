import { performance } from "node:perf_hooks";

import { getMigrationAdapter } from "../adapters/registry";
import { getLineageActionForRecord } from "../ledger";
import { buildHumanReport, buildMachineReport } from "../reporters/buildReports";
import { PHOENIX_V1_PAST_EVENTS_EXCLUSION_POLICY, shouldExcludePastEvent } from "../validators/policies";
import type { FindLineageBySourceRecordKeysInput, LineageAction, LineageMap } from "../ledger";
import type {
  MigrationAdapterContext,
  MigrationDiscoveryFilters,
  MigrationError,
  MigrationPlan,
  MigrationPlanItem,
  MigrationPlanStats,
  MigrationReport,
  NormalizedRecord,
  SourceRecordEnvelope,
} from "../types";

export const PHASE_7_COMMIT_MODE_ERROR =
  "Commit mode is not implemented in Phase 7";

/**
 * The narrowest slice of `MigrationLedgerRepository` this engine needs — a
 * plain structural interface, not the concrete class, so `core/` never
 * hard-depends on the ledger's Prisma-backed implementation (a fake object
 * satisfying this shape is enough for tests).
 */
export interface MigrationLineageLookup {
  findLineageBySourceRecordKeys(input: FindLineageBySourceRecordKeysInput): Promise<LineageMap>;
}

export interface MigrationRunPlanInput {
  adapterKey: string;
  sourceNamespace: string;
  records?: readonly SourceRecordEnvelope[];
  sourceConfig?: Record<string, unknown>;
  filters?: MigrationDiscoveryFilters;
  /** Optional read-only lineage lookup. Omitted (or a source with no prior history) → every successful normalize plans as CREATE, same as before PR6.5. */
  ledger?: MigrationLineageLookup;
  now?: Date;
}

export interface MigrationDryRunResult {
  plan: MigrationPlan;
  reports: {
    machine: MigrationReport;
    human: MigrationReport;
  };
}

// ---------------------------------------------------------------------------
// Generic post-discovery filtering — applied regardless of whether records
// came from `input.records` or from `adapter.discoverRecords()`, so an
// adapter that doesn't honor `context.filters` (or a caller that passes
// records directly, e.g. in tests) still gets consistent behavior.
// ---------------------------------------------------------------------------

function filterByEntityTypes(
  records: readonly SourceRecordEnvelope[],
  entityTypes: readonly string[] | undefined,
): readonly SourceRecordEnvelope[] {
  if (!entityTypes || entityTypes.length === 0) return records;
  const allowed = new Set(entityTypes);
  return records.filter((record) => allowed.has(record.sourceEntityType));
}

/**
 * Caps each distinct `sourceEntityType` independently to `limit`, rather
 * than a single global slice — a discovery result mixing e.g. articles and
 * places should return up to `limit` of *each*, not `limit` total with one
 * type crowding out the other.
 */
function filterByLimitPerEntityType(
  records: readonly SourceRecordEnvelope[],
  limit: number | undefined,
): readonly SourceRecordEnvelope[] {
  if (limit === undefined) return records;
  const seenCountByType = new Map<string, number>();
  return records.filter((record) => {
    const count = seenCountByType.get(record.sourceEntityType) ?? 0;
    if (count >= limit) return false;
    seenCountByType.set(record.sourceEntityType, count + 1);
    return true;
  });
}

/** Only records that opt in via `metadata.startsAt` are subject to this policy — everything else passes through untouched. */
function isExcludedPastEvent(record: SourceRecordEnvelope, now: Date | undefined): boolean {
  const startsAt = record.metadata?.startsAt as Date | string | null | undefined;
  if (startsAt === undefined || startsAt === null) return false;
  return shouldExcludePastEvent({ startsAt, now });
}

function extractStringField(payload: unknown, key: "title" | "slug"): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function toNormalizedItem(
  record: SourceRecordEnvelope,
  normalized: NormalizedRecord,
  action: LineageAction,
): MigrationPlanItem {
  return {
    sourceRecordKey: record.sourceRecordKey,
    sourceEntityType: record.sourceEntityType,
    action,
    status: action === "SKIP_UNCHANGED" ? "SKIPPED" : "PLANNED",
    targetType: normalized.targetTypeHint,
    summary: {
      title: extractStringField(normalized.normalizedPayload, "title"),
      slug: extractStringField(normalized.normalizedPayload, "slug"),
      mediaRefCount: normalized.mediaRefs?.length ?? 0,
      relationRefCount: normalized.relationRefs?.length ?? 0,
    },
    warnings: normalized.warnings,
  };
}

/**
 * CREATE unless a batch lineage lookup found an active lineage row for this
 * record's `sourceRecordKey` with a matching `targetType` — in which case
 * `getLineageActionForRecord` (pure, from the ledger module) decides
 * UPDATE vs SKIP_UNCHANGED by comparing `lastSourceHash`. No ledger, no
 * `targetTypeHint`, or no `sourceHash` to compare against → CREATE, same as
 * before PR6.5.
 */
function resolveLineageAction(
  record: SourceRecordEnvelope,
  normalized: NormalizedRecord,
  lineageByKey: LineageMap,
): LineageAction {
  if (normalized.targetTypeHint === undefined || record.sourceHash === undefined) {
    return "CREATE";
  }
  return getLineageActionForRecord({
    lineage: lineageByKey.get(record.sourceRecordKey),
    targetType: normalized.targetTypeHint,
    sourceHash: record.sourceHash,
  });
}

function toSkipPolicyItem(record: SourceRecordEnvelope): MigrationPlanItem {
  return {
    sourceRecordKey: record.sourceRecordKey,
    sourceEntityType: record.sourceEntityType,
    action: "SKIP_POLICY",
    status: "SKIPPED",
    summary: {
      policyKey: PHOENIX_V1_PAST_EVENTS_EXCLUSION_POLICY.policyKey,
      reasonCode: PHOENIX_V1_PAST_EVENTS_EXCLUSION_POLICY.reasonCode,
    },
  };
}

function toFailItem(record: SourceRecordEnvelope): MigrationPlanItem {
  return {
    sourceRecordKey: record.sourceRecordKey,
    sourceEntityType: record.sourceEntityType,
    action: "FAIL",
    status: "FAILED",
  };
}

function tally(items: readonly MigrationPlanItem[], key: (item: MigrationPlanItem) => string | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    if (value === undefined) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function computeWarningCounts(items: readonly MigrationPlanItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const warning of item.warnings ?? []) {
      counts[warning.code] = (counts[warning.code] ?? 0) + 1;
    }
  }
  return counts;
}

/** Computed once per run so every caller (CLI, future review UI) reads the same numbers instead of recomputing them. */
function computeStats(
  discoveredCount: number,
  items: readonly MigrationPlanItem[],
): Omit<MigrationPlanStats, "durationsMs"> {
  const actionCounts = tally(items, (item) => item.action);
  // Every one of these three actions comes from a normalizeRecord() call
  // that succeeded — CREATE/UPDATE/SKIP_UNCHANGED only differ in what the
  // lineage lookup decided to do with that result, not in whether
  // normalization itself worked. `skippedCount` intentionally stays
  // SKIP_POLICY-only (business-rule exclusions like past events) — a
  // distinct concept from SKIP_UNCHANGED (nothing to do, already imported),
  // which is still visible separately via `actionCounts.SKIP_UNCHANGED`.
  const normalizedCount =
    (actionCounts["CREATE"] ?? 0) + (actionCounts["UPDATE"] ?? 0) + (actionCounts["SKIP_UNCHANGED"] ?? 0);
  const failedCount = actionCounts["FAIL"] ?? 0;
  const skippedCount = actionCounts["SKIP_POLICY"] ?? 0;

  return {
    discoveredCount,
    plannedCount: items.length,
    normalizedCount,
    failedCount,
    skippedCount,
    successRate: discoveredCount === 0 ? 0 : normalizedCount / discoveredCount,
    actionCounts,
    statusCounts: tally(items, (item) => item.status),
    targetTypeCounts: tally(items, (item) => item.targetType),
    sourceEntityTypeCounts: tally(items, (item) => item.sourceEntityType),
    warningCounts: computeWarningCounts(items),
  };
}

/**
 * The real discover -> normalize -> plan loop. If `input.ledger` is
 * provided, a single batch lookup (see PR6's `findLineageBySourceRecordKeys`)
 * fetches existing lineage for every filtered record up front, and each
 * successful normalize is planned as CREATE/UPDATE/SKIP_UNCHANGED based on
 * that lineage (see `resolveLineageAction`). Without a ledger — or for a
 * record with no matching lineage — everything is CREATE, same as before
 * PR6.5. `adapter.createPlan` is intentionally not wired in here: this
 * default engine loop is meant to work without it, and no registered
 * adapter defines it yet.
 */
export async function createMigrationRunPlan(
  input: MigrationRunPlanInput,
): Promise<MigrationPlan> {
  const runStartedAt = performance.now();

  const adapter = getMigrationAdapter(input.adapterKey);

  if (!adapter) {
    throw new Error(`Migration adapter "${input.adapterKey}" is not registered`);
  }

  const context: MigrationAdapterContext = {
    sourceNamespace: input.sourceNamespace,
    config: input.sourceConfig,
    filters: input.filters,
    now: input.now,
  };

  const discoverStartedAt = performance.now();
  let records: readonly SourceRecordEnvelope[];
  if (input.records) {
    records = input.records;
  } else {
    if (!adapter.discoverRecords) {
      throw new Error(
        `Migration adapter "${adapter.metadata.key}" does not support discoverRecords() and no records were provided`,
      );
    }
    records = await adapter.discoverRecords(context);
  }
  const discoverDurationMs = performance.now() - discoverStartedAt;

  const filterStartedAt = performance.now();
  records = filterByEntityTypes(records, input.filters?.entityTypes);
  records = filterByLimitPerEntityType(records, input.filters?.limit);
  const discoveredCount = records.length;

  // Batch lineage lookup — one call for every filtered record, never one
  // per record inside the loop below. Timed as part of "filter" (this is
  // prep work before normalize, same window PR5.5 already measured here).
  const lineageByKey: LineageMap =
    records.length > 0 && input.ledger
      ? await input.ledger.findLineageBySourceRecordKeys({
          adapterKey: input.adapterKey,
          sourceNamespace: input.sourceNamespace,
          keys: records.map((record) => record.sourceRecordKey),
        })
      : new Map();
  const filterDurationMs = performance.now() - filterStartedAt;

  const items: MigrationPlanItem[] = [];
  const errors: MigrationError[] = [];

  const normalizeStartedAt = performance.now();
  for (const record of records) {
    if (input.filters?.excludePastEvents && isExcludedPastEvent(record, input.now)) {
      items.push(toSkipPolicyItem(record));
      continue;
    }

    if (!adapter.normalizeRecord) {
      throw new Error(`Migration adapter "${adapter.metadata.key}" does not support normalizeRecord()`);
    }

    try {
      const normalized = await adapter.normalizeRecord(record, context);
      const action = resolveLineageAction(record, normalized, lineageByKey);
      items.push(toNormalizedItem(record, normalized, action));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({
        code: "NORMALIZE_FAILED",
        message,
        severity: "ERROR",
        sourceRecordKey: record.sourceRecordKey,
        retryable: false,
      });
      items.push(toFailItem(record));
    }
  }
  const normalizeDurationMs = performance.now() - normalizeStartedAt;

  const planStartedAt = performance.now();
  const statsWithoutDurations = computeStats(discoveredCount, items);
  const planDurationMs = performance.now() - planStartedAt;

  const stats: MigrationPlanStats = {
    ...statsWithoutDurations,
    durationsMs: {
      discover: discoverDurationMs,
      filter: filterDurationMs,
      normalize: normalizeDurationMs,
      plan: planDurationMs,
      total: performance.now() - runStartedAt,
    },
  };

  return {
    adapterKey: adapter.metadata.key,
    adapterVersion: adapter.metadata.version,
    sourceNamespace: input.sourceNamespace,
    mode: "DRY_RUN",
    createdAt: (input.now ?? new Date()).toISOString(),
    records,
    items,
    warnings: [],
    errors,
    stats,
  };
}

export async function runMigrationDryRun(
  input: MigrationRunPlanInput,
): Promise<MigrationDryRunResult> {
  const plan = await createMigrationRunPlan(input);

  return {
    plan,
    reports: {
      machine: buildMachineReport(plan),
      human: buildHumanReport(plan),
    },
  };
}

export async function runMigrationCommit(): Promise<never> {
  throw new Error(PHASE_7_COMMIT_MODE_ERROR);
}
