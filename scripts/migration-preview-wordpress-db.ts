/**
 * Read-only WordPress -> Phoenix preview pipeline.
 *
 * WordPress DB -> WordPressRepository -> wordpress-db MigrationAdapter
 * (normalizePlace()/normalizeArticle()) -> Phoenix Engine
 * (core/orchestrator.ts, discover -> normalize -> plan) -> human report
 * (stdout) + optional JSON report (--out). Nothing is written to any
 * database, no MigrationRun/MigrationRecord rows are created, and there is
 * no commit path here — this is purely a dry-run preview so an editor can
 * see what an import would produce before any of it happens for real.
 *
 * The CLI is a thin shell around the engine: it only reads args/env, wires
 * an executor, and renders `MigrationPlan.items`/`MigrationPlan.stats` —
 * both computed once by the engine (`createMigrationRunPlan`), never
 * recomputed here.
 *
 * Run:
 *   pnpm migration:preview:wordpress-db --entity place --limit 20
 *   pnpm migration:preview:wordpress-db --entity article
 *   pnpm migration:preview:wordpress-db --entity all --out preview.json
 *
 * Required env vars (same as migration:inspect:wordpress-db): WP_SSH_HOST,
 * WP_SSH_USER, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD. A non-localhost
 * WP_SSH_HOST additionally requires --allow-remote-readonly.
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import {
  ARTICLE_ENTITY_TYPE,
  EVENT_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  ROUTE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  fetchPublishedArticleEnvelopeBySourceRecordKey,
  fetchPublishedEventEnvelopeBySourceRecordKey,
  fetchPublishedPlaceEnvelopeBySourceRecordKey,
  fetchPublishedRouteEnvelopeBySourceRecordKey,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { getMigrationAdapter } from "../src/lib/migration/adapters/registry";
import { classifyPlaceUpdateSafety } from "../src/lib/migration/commit/place/classifyPlaceUpdateSafety";
import { runMigrationDryRun } from "../src/lib/migration/core/orchestrator";
import { MigrationLedgerRepository } from "../src/lib/migration/ledger/MigrationLedgerRepository";
import { resolveMigrationEnvironment } from "../src/lib/migration/runtime/MigrationProfile";
import { resolveSampledMediaPolicy } from "../src/lib/migration/runtime/sampledMediaPolicy";
import type { PlaceUpdateConflictReason } from "../src/lib/migration/commit/place/classifyPlaceUpdateSafety";
import type { MigrationLineageLookup } from "../src/lib/migration/core/orchestrator";
import type { MigrationPlan, MigrationPlanItem, MigrationPlanStats, MigrationWarning } from "../src/lib/migration/types";

export type PreviewEntity = "article" | "place" | "event" | "route" | "all";

export interface PreviewReportOptions {
  entity: PreviewEntity;
  limit: number | null;
}

export interface PreviewCandidateSummary {
  sourceRecordKey: string;
  sourceEntityType: string;
  targetTypeHint?: string;
  title: string | null;
  slug: string | null;
  action: string;
  status: string;
  targetId?: string;
  conflictReason?: PlaceUpdateConflictReason;
  warnings: readonly MigrationWarning[];
  mediaRefCount: number;
  relationRefCount: number;
  mediaPolicy?: string;
  plannedMediaAction?: "FULL_IMPORT" | "METADATA_ONLY" | "NO_MEDIA";
  addressSummary?: string | null;
  hasCity?: boolean;
  hasCategory?: boolean;
  hasCoordinates?: boolean;
  /** Materialized per-day session count (see `materializeEventScheduleSessions()`) — never the raw boundary-date count. Events only. */
  sessionCount?: number;
  /** Raw `scheduleDraft.scheduleItems.length` — diagnostic, not the session count. Events only. */
  rawRangeCount?: number;
  /** Raw `scheduleDraft.dates.length` — the boundary-marker count for range schedules; diagnostic, not the session count. Events only. */
  boundaryDateCount?: number;
  firstSessionDate?: string | null;
  lastSessionDate?: string | null;
}

export interface PreviewJsonReport {
  source: string;
  generatedAt: string;
  entity: PreviewEntity;
  limit: number | null;
  stats?: MigrationPlanStats;
  candidates: readonly PreviewCandidateSummary[];
}

// ---------------------------------------------------------------------------
// Report building — pure functions of a `MigrationPlan`, no DB/network
// access, unit-testable without SSH/DB. Every breakdown (action/entity/
// warning counts) is read straight from `plan.stats` — nothing here
// recomputes it.
// ---------------------------------------------------------------------------

const WARNING_LABELS: Record<string, string> = {
  ARTICLE_ELEMENTOR_CONTENT: "Elementor articles",
  ARTICLE_WEB_STORY: "Web Stories",
  ARTICLE_MISSING_FEATURED_IMAGE: "articles without a featured image",
  PLACE_MISSING_COORDINATES: "places without coordinates",
  PLACE_LOGO_PRESENT: "places with a logo included in FULL import",
};

function warningLabel(code: string): string {
  return WARNING_LABELS[code] ?? code;
}

/** Reads only `summary.title`/`summary.slug`/ref counts — never the full normalizedPayload, so content/rawMeta can't leak here. */
function toCandidateSummary(item: MigrationPlanItem): PreviewCandidateSummary {
  const summary = (item.summary ?? {}) as {
    title?: unknown;
    slug?: unknown;
    mediaRefCount?: unknown;
    relationRefCount?: unknown;
    targetId?: unknown;
    conflictReason?: unknown;
    mediaPolicy?: unknown;
    plannedMediaAction?: unknown;
    addressSummary?: unknown;
    hasCity?: unknown;
    hasCategory?: unknown;
    hasCoordinates?: unknown;
    sessionCount?: unknown;
    rawRangeCount?: unknown;
    boundaryDateCount?: unknown;
    firstSessionDate?: unknown;
    lastSessionDate?: unknown;
  };
  return {
    sourceRecordKey: item.sourceRecordKey,
    sourceEntityType: item.sourceEntityType,
    targetTypeHint: item.targetType,
    title: typeof summary.title === "string" ? summary.title : null,
    slug: typeof summary.slug === "string" ? summary.slug : null,
    action: item.action,
    status: item.status,
    targetId: typeof summary.targetId === "string" ? summary.targetId : undefined,
    conflictReason:
      typeof summary.conflictReason === "string"
        ? (summary.conflictReason as PlaceUpdateConflictReason)
        : undefined,
    warnings: item.warnings ?? [],
    mediaRefCount: typeof summary.mediaRefCount === "number" ? summary.mediaRefCount : 0,
    relationRefCount: typeof summary.relationRefCount === "number" ? summary.relationRefCount : 0,
    mediaPolicy: typeof summary.mediaPolicy === "string" ? summary.mediaPolicy : undefined,
    plannedMediaAction:
      summary.plannedMediaAction === "FULL_IMPORT" ||
      summary.plannedMediaAction === "METADATA_ONLY" ||
      summary.plannedMediaAction === "NO_MEDIA"
        ? summary.plannedMediaAction
        : undefined,
    addressSummary:
      typeof summary.addressSummary === "string" || summary.addressSummary === null
        ? summary.addressSummary
        : undefined,
    hasCity: typeof summary.hasCity === "boolean" ? summary.hasCity : undefined,
    hasCategory: typeof summary.hasCategory === "boolean" ? summary.hasCategory : undefined,
    hasCoordinates: typeof summary.hasCoordinates === "boolean" ? summary.hasCoordinates : undefined,
    sessionCount: typeof summary.sessionCount === "number" ? summary.sessionCount : undefined,
    rawRangeCount: typeof summary.rawRangeCount === "number" ? summary.rawRangeCount : undefined,
    boundaryDateCount: typeof summary.boundaryDateCount === "number" ? summary.boundaryDateCount : undefined,
    firstSessionDate:
      typeof summary.firstSessionDate === "string" || summary.firstSessionDate === null
        ? summary.firstSessionDate
        : undefined,
    lastSessionDate:
      typeof summary.lastSessionDate === "string" || summary.lastSessionDate === null
        ? summary.lastSessionDate
        : undefined,
  };
}

function retally(items: readonly MigrationPlanItem[], key: (item: MigrationPlanItem) => string | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    if (value) counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function retallyWarnings(items: readonly MigrationPlanItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const warning of item.warnings ?? []) {
      counts[warning.code] = (counts[warning.code] ?? 0) + 1;
    }
  }
  return counts;
}

function recomputePlanStats(plan: MigrationPlan, items: readonly MigrationPlanItem[]): MigrationPlanStats | undefined {
  if (!plan.stats) return undefined;
  const actionCounts = retally(items, (item) => item.action);
  const failedCount = actionCounts.FAIL ?? 0;
  const skippedCount = actionCounts.SKIP_POLICY ?? 0;
  const normalizedCount =
    (actionCounts.CREATE ?? 0) +
    (actionCounts.UPDATE ?? 0) +
    (actionCounts.SKIP_UNCHANGED ?? 0) +
    (actionCounts.UPDATE_CONFLICT ?? 0);
  return {
    ...plan.stats,
    plannedCount: items.length,
    normalizedCount,
    failedCount,
    skippedCount,
    successRate: plan.stats.discoveredCount === 0 ? 0 : normalizedCount / plan.stats.discoveredCount,
    actionCounts,
    statusCounts: retally(items, (item) => item.status),
    targetTypeCounts: retally(items, (item) => item.targetType),
    sourceEntityTypeCounts: retally(items, (item) => item.sourceEntityType),
    warningCounts: retallyWarnings(items),
  };
}

function withMediaPlanSummary(item: MigrationPlanItem): MigrationPlanItem {
  if (item.targetType !== "PLACE") return item;
  const summary = { ...(item.summary ?? {}) };
  const mediaRefCount = typeof summary.mediaRefCount === "number" ? summary.mediaRefCount : 0;
  const mediaPolicy = resolveSampledMediaPolicy({
    environment: resolveMigrationEnvironment(process.env),
    sourceRecordKey: item.sourceRecordKey,
  }).policy.name;
  const plannedMediaAction =
    mediaRefCount === 0 ? "NO_MEDIA" : mediaPolicy === "FULL" ? "FULL_IMPORT" : "METADATA_ONLY";
  return { ...item, summary: { ...summary, mediaPolicy, plannedMediaAction } };
}

export async function applyStateAwarePlacePreview(input: {
  plan: MigrationPlan;
  sourceId: string | null;
  prisma: Parameters<typeof classifyPlaceUpdateSafety>[0]["prisma"];
}): Promise<MigrationPlan> {
  const items: MigrationPlanItem[] = [];
  for (const item of input.plan.items) {
    const withMedia = withMediaPlanSummary(item);
    if (withMedia.targetType !== "PLACE" || withMedia.action !== "UPDATE") {
      items.push(withMedia);
      continue;
    }
    if (!input.sourceId) {
      items.push({
        ...withMedia,
        action: "UPDATE_CONFLICT",
        status: "BLOCKED",
        summary: { ...(withMedia.summary ?? {}), conflictReason: "LINEAGE_MISSING" satisfies PlaceUpdateConflictReason },
      });
      continue;
    }
    const classification = await classifyPlaceUpdateSafety({
      prisma: input.prisma,
      sourceId: input.sourceId,
      sourceRecordKey: withMedia.sourceRecordKey,
    });
    if (classification.classification === "UPDATE_SAFE") {
      items.push({
        ...withMedia,
        summary: { ...(withMedia.summary ?? {}), targetId: classification.targetId },
      });
      continue;
    }
    items.push({
      ...withMedia,
      action: "UPDATE_CONFLICT",
      status: "BLOCKED",
      summary: {
        ...(withMedia.summary ?? {}),
        targetId: classification.targetId,
        conflictReason: classification.reason,
      },
    });
  }

  return { ...input.plan, items, stats: recomputePlanStats(input.plan, items) };
}

function pushRecordBreakdown(push: (line?: string) => void, title: string, counts: Record<string, number>): void {
  push(title);
  const keys = Object.keys(counts).sort();
  if (keys.length === 0) {
    push("  (none)");
    return;
  }
  for (const key of keys) {
    push(`  ${key}: ${counts[key]}`);
  }
}

export function buildPreviewHumanReport(plan: MigrationPlan, options: PreviewReportOptions): string {
  const lines: string[] = [];
  const push = (line = "") => lines.push(line);

  push("Migration Preview");
  push();
  push(`source: ${plan.adapterKey}`);
  push(`entity: ${options.entity}`);
  push(`limit: ${options.limit ?? "(default)"}`);
  push();

  const stats = plan.stats;
  if (!stats) {
    push("(no stats available on this plan)");
    return lines.join("\n");
  }

  push(`Discovered: ${stats.discoveredCount}`);
  push(`Normalized: ${stats.normalizedCount}`);
  push(`Failed: ${stats.failedCount}`);
  push(`Skipped: ${stats.skippedCount}`);
  push(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
  push();

  pushRecordBreakdown(push, "Action counts", stats.actionCounts);
  push();
  pushRecordBreakdown(push, "Target type counts", stats.targetTypeCounts);
  push();
  pushRecordBreakdown(push, "Source entity type counts", stats.sourceEntityTypeCounts);
  push();

  push("Warning counts");
  const warningCodes = Object.keys(stats.warningCounts).sort();
  if (warningCodes.length === 0) {
    push("  (none)");
  } else {
    for (const code of warningCodes) {
      push(`  • ${stats.warningCounts[code]} ${warningLabel(code)}`);
    }
  }
  push();

  push("Durations (ms)");
  push(`  discover: ${stats.durationsMs.discover.toFixed(1)}`);
  push(`  normalize: ${stats.durationsMs.normalize.toFixed(1)}`);
  push(`  total: ${stats.durationsMs.total.toFixed(1)}`);
  push();

  const candidates = plan.items.map(toCandidateSummary);
  push("Sample candidates (first 3)");
  if (candidates.length === 0) {
    push("(none)");
  } else {
    for (const candidate of candidates.slice(0, 3)) {
      const warningCodes = candidate.warnings.map((w) => w.code).slice(0, 5);
      const warningCodesLabel =
        warningCodes.length > 0
          ? ` | warningCodes: ${warningCodes.join(", ")}${candidate.warnings.length > warningCodes.length ? ", …" : ""}`
          : "";
      const targetLabel = candidate.targetId ? ` | targetId: ${candidate.targetId}` : "";
      const conflictLabel = candidate.conflictReason ? ` | conflict: ${candidate.conflictReason}` : "";
      const mediaLabel = candidate.mediaPolicy
        ? ` | media: ${candidate.mediaPolicy}/${candidate.plannedMediaAction ?? "NO_MEDIA"}`
        : "";
      const sessionsLabel =
        typeof candidate.sessionCount === "number"
          ? ` | sessions: ${candidate.sessionCount} (raw ranges: ${candidate.rawRangeCount ?? 0}, boundary dates: ${candidate.boundaryDateCount ?? 0})` +
            (candidate.firstSessionDate ? ` | range: ${candidate.firstSessionDate} -> ${candidate.lastSessionDate}` : "")
          : "";
      push(
        `- ${candidate.sourceRecordKey} | ${candidate.title ?? "(no title)"} | ${candidate.slug ?? "(no slug)"} ` +
          `| action: ${candidate.action} | status: ${candidate.status}${targetLabel}${conflictLabel}${mediaLabel}${sessionsLabel} ` +
          `| warnings: ${candidate.warnings.length}${warningCodesLabel} | mediaRefs: ${candidate.mediaRefCount} | relationRefs: ${candidate.relationRefCount}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * JSON report shape. `stats` is `plan.stats` verbatim. `candidates` remain
 * summary-only (`title`/`slug`/ref counts) — `MigrationPlanItem.summary`
 * never carries the full normalizedPayload, so there is structurally no way
 * for `content`/`rawMeta` to reach this report.
 */
export function buildPreviewJsonReport(plan: MigrationPlan, options: PreviewReportOptions): PreviewJsonReport {
  return {
    source: plan.adapterKey,
    generatedAt: plan.createdAt,
    entity: options.entity,
    limit: options.limit,
    stats: plan.stats,
    candidates: plan.items.map(toCandidateSummary),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): {
  entity: PreviewEntity;
  limit?: number;
  sourceRecordKey?: string;
  forceReprocess: boolean;
  out?: string;
  allowRemoteReadonly: boolean;
} {
  const entityIndex = argv.indexOf("--entity");
  const rawEntity = entityIndex !== -1 ? argv[entityIndex + 1] : undefined;
  if (
    rawEntity !== undefined &&
    rawEntity !== "article" &&
    rawEntity !== "place" &&
    rawEntity !== "event" &&
    rawEntity !== "route" &&
    rawEntity !== "all"
  ) {
    throw new Error(`Invalid --entity value "${rawEntity}". Expected article|place|event|route|all.`);
  }
  const entity: PreviewEntity = rawEntity ?? "all";

  const limitIndex = argv.indexOf("--limit");
  const rawLimit = limitIndex !== -1 ? argv[limitIndex + 1] : undefined;
  let limit: number | undefined;
  if (rawLimit !== undefined) {
    limit = Number(rawLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error(`Invalid --limit value "${rawLimit}". Expected a positive number.`);
    }
  }

  const sourceRecordKeyIndex = argv.indexOf("--source-record-key");
  const sourceRecordKey =
    sourceRecordKeyIndex !== -1 ? argv[sourceRecordKeyIndex + 1] : undefined;
  if (sourceRecordKeyIndex !== -1 && !sourceRecordKey) {
    throw new Error("Missing value for --source-record-key.");
  }

  const outIndex = argv.indexOf("--out");
  const out = outIndex !== -1 ? argv[outIndex + 1] : undefined;
  const forceReprocess = argv.includes("--force-reprocess");

  if (forceReprocess) {
    if (entity !== "article") {
      throw new Error("--force-reprocess is only supported with --entity article.");
    }
    if (!sourceRecordKey) {
      throw new Error("--force-reprocess requires --source-record-key <key>.");
    }
    if (limit !== undefined) {
      throw new Error("--force-reprocess cannot be combined with --limit (mass mode is not allowed).");
    }
  }

  const allowRemoteReadonly = argv.includes("--allow-remote-readonly");

  return { entity, limit, sourceRecordKey, forceReprocess, out, allowRemoteReadonly };
}

function entityTypesFor(entity: PreviewEntity): readonly string[] | undefined {
  if (entity === "article") return [ARTICLE_ENTITY_TYPE];
  if (entity === "place") return [PLACE_ENTITY_TYPE];
  if (entity === "event") return [EVENT_ENTITY_TYPE];
  if (entity === "route") return [ROUTE_ENTITY_TYPE];
  return undefined;
}

export function includesPlacePreview(entity: PreviewEntity): boolean {
  return entity === "place" || entity === "all";
}

async function main(): Promise<void> {
  const { entity, limit, sourceRecordKey, forceReprocess, out, allowRemoteReadonly } = parseArgs(process.argv.slice(2));

  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, allowRemoteReadonly);

  if (!getMigrationAdapter(WORDPRESS_DB_ADAPTER_KEY)) {
    registerWordPressDbAdapter();
  }

  const executor = createWordPressSshMysqlExecutor(config);
  let prisma: PrismaClient | null = null;
  let ledger: MigrationLineageLookup | undefined;
  let sourceId: string | null = null;
  const hasStateAwarePlacePreview = includesPlacePreview(entity);
  if (hasStateAwarePlacePreview) {
    prisma = new PrismaClient();
    const repository = new MigrationLedgerRepository(prisma);
    ledger = repository;
    const source = await repository.findSourceByAdapter(WORDPRESS_DB_ADAPTER_KEY, "wordpress-db");
    sourceId = source?.id ?? null;
  }

  try {
    let records;
    if (sourceRecordKey) {
      if (entity === "article") {
        records = [await fetchPublishedArticleEnvelopeBySourceRecordKey(executor, sourceRecordKey)];
      } else if (entity === "place") {
        records = [await fetchPublishedPlaceEnvelopeBySourceRecordKey(executor, sourceRecordKey)];
      } else if (entity === "event") {
        records = [await fetchPublishedEventEnvelopeBySourceRecordKey(executor, sourceRecordKey)];
      } else if (entity === "route") {
        records = [await fetchPublishedRouteEnvelopeBySourceRecordKey(executor, sourceRecordKey)];
      } else {
        throw new Error("--source-record-key is only supported with --entity article|place|event|route for golden-sample runs.");
      }
    }

    const { plan: rawPlan } = await runMigrationDryRun({
      adapterKey: WORDPRESS_DB_ADAPTER_KEY,
      sourceNamespace: "wordpress-db",
      sourceConfig: { executor },
      records,
      filters: { entityTypes: entityTypesFor(entity), limit: sourceRecordKey ? 1 : limit },
      ledger,
    });
    let plan = rawPlan;
    if (hasStateAwarePlacePreview && prisma) {
      plan = await applyStateAwarePlacePreview({ plan: rawPlan, sourceId, prisma });
    }
    if (forceReprocess && sourceRecordKey) {
      const mutableItems = [...plan.items];
      for (const item of mutableItems) {
        if (item.sourceRecordKey === sourceRecordKey && item.action === "SKIP_UNCHANGED") {
          item.action = "UPDATE";
          item.status = "PLANNED";
        }
      }
      plan = { ...plan, items: mutableItems, stats: recomputePlanStats(plan, mutableItems) };
    }

    const options: PreviewReportOptions = { entity, limit: limit ?? null };

    console.log(buildPreviewHumanReport(plan, options));

    if (out) {
      writeFileSync(out, JSON.stringify(buildPreviewJsonReport(plan, options), null, 2));
      console.log(`\nJSON report written to ${out}`);
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\nmigration:preview:wordpress-db failed: ${error.message}`);
    process.exitCode = 1;
  });
}
