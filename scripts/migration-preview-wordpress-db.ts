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

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import {
  ARTICLE_ENTITY_TYPE,
  EVENT_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  fetchPublishedArticleEnvelopeBySourceRecordKey,
  fetchPublishedEventEnvelopeBySourceRecordKey,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { getMigrationAdapter } from "../src/lib/migration/adapters/registry";
import { runMigrationDryRun } from "../src/lib/migration/core/orchestrator";
import type { MigrationPlan, MigrationPlanItem, MigrationPlanStats, MigrationWarning } from "../src/lib/migration/types";

export type PreviewEntity = "article" | "place" | "event" | "all";

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
  warnings: readonly MigrationWarning[];
  mediaRefCount: number;
  relationRefCount: number;
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
  PLACE_LOGO_EXCLUDED: "places with a logo excluded from import",
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
  };
  return {
    sourceRecordKey: item.sourceRecordKey,
    sourceEntityType: item.sourceEntityType,
    targetTypeHint: item.targetType,
    title: typeof summary.title === "string" ? summary.title : null,
    slug: typeof summary.slug === "string" ? summary.slug : null,
    action: item.action,
    status: item.status,
    warnings: item.warnings ?? [],
    mediaRefCount: typeof summary.mediaRefCount === "number" ? summary.mediaRefCount : 0,
    relationRefCount: typeof summary.relationRefCount === "number" ? summary.relationRefCount : 0,
  };
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
      push(
        `- ${candidate.sourceRecordKey} | ${candidate.title ?? "(no title)"} | ${candidate.slug ?? "(no slug)"} ` +
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
    rawEntity !== "all"
  ) {
    throw new Error(`Invalid --entity value "${rawEntity}". Expected article|place|event|all.`);
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
  return undefined;
}

async function main(): Promise<void> {
  const { entity, limit, sourceRecordKey, forceReprocess, out, allowRemoteReadonly } = parseArgs(process.argv.slice(2));

  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, allowRemoteReadonly);

  if (!getMigrationAdapter(WORDPRESS_DB_ADAPTER_KEY)) {
    registerWordPressDbAdapter();
  }

  const executor = createWordPressSshMysqlExecutor(config);

  let records;
  if (sourceRecordKey) {
    if (entity === "article") {
      records = [await fetchPublishedArticleEnvelopeBySourceRecordKey(executor, sourceRecordKey)];
    } else if (entity === "event") {
      records = [await fetchPublishedEventEnvelopeBySourceRecordKey(executor, sourceRecordKey)];
    } else {
      throw new Error("--source-record-key is only supported with --entity article|event for golden-sample runs.");
    }
  }

  const { plan } = await runMigrationDryRun({
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "wordpress-db",
    sourceConfig: { executor },
    records,
    filters: { entityTypes: entityTypesFor(entity), limit: sourceRecordKey ? 1 : limit },
  });
  if (forceReprocess && sourceRecordKey) {
    for (const item of plan.items) {
      if (item.sourceRecordKey === sourceRecordKey && item.action === "SKIP_UNCHANGED") {
        item.action = "UPDATE";
        item.status = "PLANNED";
      }
    }
  }

  const options: PreviewReportOptions = { entity, limit: limit ?? null };

  console.log(buildPreviewHumanReport(plan, options));

  if (out) {
    writeFileSync(out, JSON.stringify(buildPreviewJsonReport(plan, options), null, 2));
    console.log(`\nJSON report written to ${out}`);
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
