import { performance } from "node:perf_hooks";

import { materializeEventScheduleSessions } from "@/lib/event/materializeScheduleSessions";
import { getMigrationAdapter } from "../adapters/registry";
import { getLineageActionForRecord } from "../ledger";
import { buildHumanReport, buildMachineReport } from "../reporters/buildReports";
import {
  OWNER_EXCLUDED_LEGACY_ARTICLES_POLICY,
  OWNER_EXCLUDED_LEGACY_EVENTS_POLICY,
  OWNER_EXCLUDED_LEGACY_OFFERS_POLICY,
  PHOENIX_V1_PAST_EVENTS_EXCLUSION_POLICY,
  isOwnerExcludedLegacyArticleSourceRecordKey,
  isOwnerExcludedLegacyEventSourceRecordKey,
  isOwnerExcludedLegacyOfferSourceRecordKey,
  shouldExcludePastEvent,
} from "../validators/policies";
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

function extractPlacePreviewFields(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) return {};
  const record = payload as Record<string, unknown>;
  const sourceTerms = record.sourceTerms;
  const coordinates = record.coordinates;
  return {
    addressSummary: typeof record.addressText === "string" ? record.addressText : null,
    hasCity: typeof record.cityRaw === "string" && record.cityRaw.trim().length > 0,
    hasCategory: Array.isArray(sourceTerms) && sourceTerms.length > 0,
    hasCoordinates: typeof coordinates === "object" && coordinates !== null,
  };
}

/**
 * `sessionCount`/`sessionDateRange` are the *materialized* per-day count —
 * see `materializeEventScheduleSessions()` — never `scheduleDraft.dates.length`.
 * For a range-based schedule (`scheduleItems` present, e.g. a multi-day camp
 * shift), `dates` only holds each range's boundary markers; reporting that
 * length as "sessions" undercounts what the real commit actually creates
 * (confirmed for wordpress-db:events:60404: 6 boundary dates across 3
 * ranges, 36 materialized daily sessions).
 */
function extractEventPreviewFields(payload: unknown): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) return {};
  const record = payload as Record<string, unknown>;
  const materialized = materializeEventScheduleSessions(record.scheduleDraft ?? null);
  return {
    rawRangeCount: materialized.rawRangeCount,
    boundaryDateCount: materialized.boundaryDateCount,
    sessionCount: materialized.materializedSessionCount,
    firstSessionDate: materialized.firstSessionDate,
    lastSessionDate: materialized.lastSessionDate,
  };
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
      ...(normalized.targetTypeHint === "PLACE" ? extractPlacePreviewFields(normalized.normalizedPayload) : {}),
      ...(normalized.targetTypeHint === "ACTIVITY" ? extractEventPreviewFields(normalized.normalizedPayload) : {}),
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

/**
 * Pre-normalize, unconditional (not gated behind a filter flag like
 * `excludePastEvents`) — the owner's exclusion decision must never depend on
 * a caller remembering to pass a flag. Never reaches `normalizeRecord()`, so
 * it never produces an `executionCandidate` and never touches lineage.
 */
function toOwnerExcludedLegacyOfferSkipItem(record: SourceRecordEnvelope): MigrationPlanItem {
  return {
    sourceRecordKey: record.sourceRecordKey,
    sourceEntityType: record.sourceEntityType,
    action: "SKIP_POLICY",
    status: "SKIPPED",
    targetType: OWNER_EXCLUDED_LEGACY_OFFERS_POLICY.targetType,
    summary: {
      policyKey: OWNER_EXCLUDED_LEGACY_OFFERS_POLICY.policyKey,
      reasonCode: OWNER_EXCLUDED_LEGACY_OFFERS_POLICY.reasonCode,
    },
  };
}

/**
 * Same pre-normalize, unconditional treatment as
 * `toOwnerExcludedLegacyOfferSkipItem` — for Event 64586 only (see
 * `OWNER_EXCLUDED_LEGACY_EVENT_IDS`). Never reaches `normalizeRecord()`, so
 * it never produces an `executionCandidate` and never touches lineage.
 */
function toOwnerExcludedLegacyEventSkipItem(record: SourceRecordEnvelope): MigrationPlanItem {
  return {
    sourceRecordKey: record.sourceRecordKey,
    sourceEntityType: record.sourceEntityType,
    action: "SKIP_POLICY",
    status: "SKIPPED",
    targetType: OWNER_EXCLUDED_LEGACY_EVENTS_POLICY.targetType,
    summary: {
      policyKey: OWNER_EXCLUDED_LEGACY_EVENTS_POLICY.policyKey,
      reasonCode: OWNER_EXCLUDED_LEGACY_EVENTS_POLICY.reasonCode,
    },
  };
}

/**
 * Same pre-normalize, unconditional treatment as
 * `toOwnerExcludedLegacyOfferSkipItem`/`toOwnerExcludedLegacyEventSkipItem`
 * — for Article 46472 only (see `OWNER_EXCLUDED_LEGACY_ARTICLE_IDS`). Never
 * reaches `normalizeRecord()`, so it never produces an `executionCandidate`
 * and never touches lineage or the generic `MISSING_CONTENT` fail-closed
 * validation.
 */
function toOwnerExcludedLegacyArticleSkipItem(record: SourceRecordEnvelope): MigrationPlanItem {
  return {
    sourceRecordKey: record.sourceRecordKey,
    sourceEntityType: record.sourceEntityType,
    action: "SKIP_POLICY",
    status: "SKIPPED",
    targetType: OWNER_EXCLUDED_LEGACY_ARTICLES_POLICY.targetType,
    summary: {
      policyKey: OWNER_EXCLUDED_LEGACY_ARTICLES_POLICY.policyKey,
      reasonCode: OWNER_EXCLUDED_LEGACY_ARTICLES_POLICY.reasonCode,
    },
  };
}

const EVENT_PAST_ONLY_EXCLUDED_WARNING_CODE = "EVENT_PAST_ONLY_EXCLUDED";

/** Set by `normalizeEvent()` (post-normalize, since only the parsed schedule can tell a past-only multi-date event from a real one) — never a pre-normalize `metadata.startsAt` check like `isExcludedPastEvent` above. */
function isPastOnlyExcludedEvent(normalized: NormalizedRecord): boolean {
  return (normalized.warnings ?? []).some((warning) => warning.code === EVENT_PAST_ONLY_EXCLUDED_WARNING_CODE);
}

function toEventPastOnlySkipPolicyItem(record: SourceRecordEnvelope, normalized: NormalizedRecord): MigrationPlanItem {
  return {
    sourceRecordKey: record.sourceRecordKey,
    sourceEntityType: record.sourceEntityType,
    action: "SKIP_POLICY",
    status: "SKIPPED",
    targetType: normalized.targetTypeHint,
    summary: {
      title: extractStringField(normalized.normalizedPayload, "title"),
      slug: extractStringField(normalized.normalizedPayload, "slug"),
      policyKey: PHOENIX_V1_PAST_EVENTS_EXCLUSION_POLICY.policyKey,
      reasonCode: EVENT_PAST_ONLY_EXCLUDED_WARNING_CODE,
    },
    warnings: normalized.warnings,
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
 * One normalized candidate, kept alongside the `MigrationPlanItem` it
 * produced. This is the runtime-only counterpart to the always-`null`
 * `MigrationRecord.normalizedPayload` — full candidates never touch the
 * database here, they just survive in memory past the point where
 * `createMigrationRunPlan()` would otherwise discard them into a lossy
 * `summary`. `TCandidate` defaults to `unknown`, matching
 * `NormalizedRecord.normalizedPayload`'s own type — narrowing to
 * `NormalizedPlaceCandidate`/`NormalizedEventCandidate`/
 * `NormalizedArticleCandidate` is a runner-dispatch-stage concern, not
 * this foundation's.
 */
export interface MigrationExecutionCandidate<TCandidate = unknown> {
  planItem: MigrationPlanItem;
  candidate: TCandidate;
}

export interface MigrationRunExecutionPlan {
  plan: MigrationPlan;
  executionCandidates: readonly MigrationExecutionCandidate[];
}

interface DiscoverNormalizeLoopResult {
  adapter: NonNullable<ReturnType<typeof getMigrationAdapter>>;
  records: readonly SourceRecordEnvelope[];
  discoveredCount: number;
  items: MigrationPlanItem[];
  errors: MigrationError[];
  executionCandidates: MigrationExecutionCandidate[];
  durationsMs: { discover: number; filter: number; normalize: number };
  runStartedAt: number;
}

/**
 * The real discover -> normalize -> (lineage action resolve) loop, shared
 * by `createMigrationRunPlan()` and `createMigrationRunExecutionPlan()` so
 * the two never drift apart. Always collects `executionCandidates` — the
 * extra array costs nothing meaningful and keeping one loop is safer than
 * two copies that could silently diverge; `createMigrationRunPlan()`
 * simply doesn't return them.
 */
async function runDiscoverNormalizeLoop(
  input: MigrationRunPlanInput,
): Promise<DiscoverNormalizeLoopResult> {
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
  const executionCandidates: MigrationExecutionCandidate[] = [];

  const normalizeStartedAt = performance.now();
  for (const record of records) {
    if (isOwnerExcludedLegacyOfferSourceRecordKey(record.sourceRecordKey)) {
      items.push(toOwnerExcludedLegacyOfferSkipItem(record));
      continue;
    }

    if (isOwnerExcludedLegacyEventSourceRecordKey(record.sourceRecordKey)) {
      items.push(toOwnerExcludedLegacyEventSkipItem(record));
      continue;
    }

    if (isOwnerExcludedLegacyArticleSourceRecordKey(record.sourceRecordKey)) {
      items.push(toOwnerExcludedLegacyArticleSkipItem(record));
      continue;
    }

    if (input.filters?.excludePastEvents && isExcludedPastEvent(record, input.now)) {
      items.push(toSkipPolicyItem(record));
      continue;
    }

    if (!adapter.normalizeRecord) {
      throw new Error(`Migration adapter "${adapter.metadata.key}" does not support normalizeRecord()`);
    }

    try {
      const normalized = await adapter.normalizeRecord(record, context);
      if (isPastOnlyExcludedEvent(normalized)) {
        items.push(toEventPastOnlySkipPolicyItem(record, normalized));
        continue;
      }
      const action = resolveLineageAction(record, normalized, lineageByKey);
      const planItem = toNormalizedItem(record, normalized, action);
      items.push(planItem);
      // CREATE/UPDATE/SKIP_UNCHANGED all come from a normalize() call that
      // succeeded — the candidate exists in every case, including
      // SKIP_UNCHANGED (already imported, nothing to do, but still a real
      // candidate). Only SKIP_POLICY (never normalized, see above) and FAIL
      // (normalize threw, see below) have no candidate to keep.
      executionCandidates.push({ planItem, candidate: normalized.normalizedPayload });
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

  return {
    adapter,
    records,
    discoveredCount,
    items,
    errors,
    executionCandidates,
    durationsMs: { discover: discoverDurationMs, filter: filterDurationMs, normalize: normalizeDurationMs },
    runStartedAt,
  };
}

function buildPlanFromLoopResult(
  input: MigrationRunPlanInput,
  loop: DiscoverNormalizeLoopResult,
): MigrationPlan {
  const planStartedAt = performance.now();
  const statsWithoutDurations = computeStats(loop.discoveredCount, loop.items);
  const planDurationMs = performance.now() - planStartedAt;

  const stats: MigrationPlanStats = {
    ...statsWithoutDurations,
    durationsMs: {
      discover: loop.durationsMs.discover,
      filter: loop.durationsMs.filter,
      normalize: loop.durationsMs.normalize,
      plan: planDurationMs,
      total: performance.now() - loop.runStartedAt,
    },
  };

  return {
    adapterKey: loop.adapter.metadata.key,
    adapterVersion: loop.adapter.metadata.version,
    sourceNamespace: input.sourceNamespace,
    mode: "DRY_RUN",
    createdAt: (input.now ?? new Date()).toISOString(),
    records: loop.records,
    items: loop.items,
    warnings: [],
    errors: loop.errors,
    stats,
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
  const loop = await runDiscoverNormalizeLoop(input);
  return buildPlanFromLoopResult(input, loop);
}

/**
 * Same discover -> normalize -> plan loop as `createMigrationRunPlan()`
 * (via the shared `runDiscoverNormalizeLoop()` helper, so the two can
 * never silently diverge), but also returns the full normalized
 * candidates alongside their `MigrationPlanItem`s — PR25 foundation only:
 * no runner is invoked, no commit mode, nothing is written to a database,
 * and `MigrationRecord`'s `rawPayload`/`normalizedPayload` behavior is
 * untouched (still always `null` wherever `MigrationRunWriter` is
 * eventually wired in). This is purely an in-memory sibling so a future
 * commit-wiring PR has something to hand to a Runner.
 */
export async function createMigrationRunExecutionPlan(
  input: MigrationRunPlanInput,
): Promise<MigrationRunExecutionPlan> {
  const loop = await runDiscoverNormalizeLoop(input);
  const plan = buildPlanFromLoopResult(input, loop);
  return { plan, executionCandidates: loop.executionCandidates };
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
