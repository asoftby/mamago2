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
 * an executor, and renders `MigrationPlan.items` — `MigrationPlan` is the
 * single source of truth for what got discovered/normalized/skipped/failed.
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
  PLACE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { getMigrationAdapter } from "../src/lib/migration/adapters/registry";
import { runMigrationDryRun } from "../src/lib/migration/core/orchestrator";
import type { MigrationPlan, MigrationPlanItem, MigrationWarning } from "../src/lib/migration/types";

export type PreviewEntity = "article" | "place" | "all";

export interface PreviewReportOptions {
  entity: PreviewEntity;
  limit: number | null;
}

export interface PreviewEntityCounts {
  discovered: number;
  normalized: number;
  failed: number;
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
  summary: {
    articles: PreviewEntityCounts | null;
    places: PreviewEntityCounts | null;
  };
  warningsByCode: Record<string, number>;
  candidates: readonly PreviewCandidateSummary[];
}

// ---------------------------------------------------------------------------
// Report building — pure functions of a `MigrationPlan`, no DB/network
// access, unit-testable without SSH/DB.
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

export function computeWarningsByCode(plan: MigrationPlan): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of plan.items) {
    for (const warning of item.warnings ?? []) {
      counts[warning.code] = (counts[warning.code] ?? 0) + 1;
    }
  }
  return counts;
}

function countByEntityType(items: readonly MigrationPlanItem[], entityType: string): PreviewEntityCounts {
  const entityItems = items.filter((item) => item.sourceEntityType === entityType);
  return {
    discovered: entityItems.length,
    normalized: entityItems.filter((item) => item.action === "CREATE").length,
    failed: entityItems.filter((item) => item.action === "FAIL").length,
  };
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

export function buildPreviewHumanReport(plan: MigrationPlan, options: PreviewReportOptions): string {
  const lines: string[] = [];
  const push = (line = "") => lines.push(line);

  push("Migration Preview");
  push();
  push(`source: ${plan.adapterKey}`);
  push(`entity: ${options.entity}`);
  push(`limit: ${options.limit ?? "(default)"}`);
  push();

  if (options.entity !== "place") {
    const counts = countByEntityType(plan.items, ARTICLE_ENTITY_TYPE);
    push("Articles:");
    push(`${counts.discovered} discovered`);
    push(`${counts.normalized} normalized`);
    push(`${counts.failed} failed`);
    push();
  }

  if (options.entity !== "article") {
    const counts = countByEntityType(plan.items, PLACE_ENTITY_TYPE);
    push("Places:");
    push(`${counts.discovered} discovered`);
    push(`${counts.normalized} normalized`);
    push(`${counts.failed} failed`);
    push();
  }

  const warningsByCode = computeWarningsByCode(plan);
  const warningCodes = Object.keys(warningsByCode).sort();
  push("Warnings");
  if (warningCodes.length === 0) {
    push("(none)");
  } else {
    for (const code of warningCodes) {
      push(`• ${warningsByCode[code]} ${warningLabel(code)}`);
    }
  }
  push();

  const candidates = plan.items.map(toCandidateSummary);
  push("Sample candidates (first 3)");
  if (candidates.length === 0) {
    push("(none)");
  } else {
    for (const candidate of candidates.slice(0, 3)) {
      push(
        `- ${candidate.sourceRecordKey} | ${candidate.title ?? "(no title)"} | ${candidate.slug ?? "(no slug)"} ` +
          `| warnings: ${candidate.warnings.length} | mediaRefs: ${candidate.mediaRefCount} | relationRefs: ${candidate.relationRefCount}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * JSON report shape. `candidates[].mediaRefCount`/`.relationRefCount` are
 * counts, not the full ref arrays — `MigrationPlanItem.summary` only ever
 * carries counts (see wordpressDbAdapter/orchestrator), so there is
 * structurally no way for `content`/`rawMeta` to reach this report.
 */
export function buildPreviewJsonReport(plan: MigrationPlan, options: PreviewReportOptions): PreviewJsonReport {
  return {
    source: plan.adapterKey,
    generatedAt: plan.createdAt,
    entity: options.entity,
    limit: options.limit,
    summary: {
      articles: options.entity !== "place" ? countByEntityType(plan.items, ARTICLE_ENTITY_TYPE) : null,
      places: options.entity !== "article" ? countByEntityType(plan.items, PLACE_ENTITY_TYPE) : null,
    },
    warningsByCode: computeWarningsByCode(plan),
    candidates: plan.items.map(toCandidateSummary),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): {
  entity: PreviewEntity;
  limit?: number;
  out?: string;
  allowRemoteReadonly: boolean;
} {
  const entityIndex = argv.indexOf("--entity");
  const rawEntity = entityIndex !== -1 ? argv[entityIndex + 1] : undefined;
  if (rawEntity !== undefined && rawEntity !== "article" && rawEntity !== "place" && rawEntity !== "all") {
    throw new Error(`Invalid --entity value "${rawEntity}". Expected article|place|all.`);
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

  const outIndex = argv.indexOf("--out");
  const out = outIndex !== -1 ? argv[outIndex + 1] : undefined;

  const allowRemoteReadonly = argv.includes("--allow-remote-readonly");

  return { entity, limit, out, allowRemoteReadonly };
}

function entityTypesFor(entity: PreviewEntity): readonly string[] | undefined {
  if (entity === "article") return [ARTICLE_ENTITY_TYPE];
  if (entity === "place") return [PLACE_ENTITY_TYPE];
  return undefined;
}

async function main(): Promise<void> {
  const { entity, limit, out, allowRemoteReadonly } = parseArgs(process.argv.slice(2));

  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, allowRemoteReadonly);

  if (!getMigrationAdapter(WORDPRESS_DB_ADAPTER_KEY)) {
    registerWordPressDbAdapter();
  }

  const executor = createWordPressSshMysqlExecutor(config);

  const { plan } = await runMigrationDryRun({
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "wordpress-db",
    sourceConfig: { executor },
    filters: { entityTypes: entityTypesFor(entity), limit },
  });

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
