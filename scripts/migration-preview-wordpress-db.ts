/**
 * Read-only WordPress -> Phoenix preview pipeline.
 *
 * WordPress DB -> WordPressRepository -> normalizePlace()/normalizeArticle()
 * -> human report (stdout) + optional JSON report (--out). Nothing is
 * written to any database, no MigrationRun/MigrationRecord rows are
 * created, and there is no commit path here — this is purely a dry-run
 * preview so an editor can see what an import would produce before any of
 * it happens for real.
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
import { normalizeArticle } from "../src/lib/migration/adapters/wordpress-db/normalizeArticle";
import { normalizePlace } from "../src/lib/migration/adapters/wordpress-db/normalizePlace";
import { WordPressRepository } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import type { MigrationWarning, NormalizedRecord } from "../src/lib/migration/types";

export type PreviewEntity = "article" | "place" | "all";

export interface PreviewFailure {
  sourceKey: string;
  message: string;
}

export interface EntityPreviewResult {
  discovered: number;
  normalized: number;
  failed: number;
  records: readonly NormalizedRecord[];
  failures: readonly PreviewFailure[];
}

export interface PreviewResult {
  source: "wordpress-db";
  entity: PreviewEntity;
  limit: number | null;
  generatedAt: string;
  articles: EntityPreviewResult | null;
  places: EntityPreviewResult | null;
}

export interface PreviewCandidateSummary {
  sourceRecordKey: string;
  targetTypeHint?: string;
  title: string | null;
  slug: string | null;
  warnings: readonly MigrationWarning[];
  mediaRefs: readonly string[];
  relationRefs: readonly string[];
}

export interface PreviewJsonReport {
  source: "wordpress-db";
  generatedAt: string;
  entity: PreviewEntity;
  limit: number | null;
  summary: {
    articles: { discovered: number; normalized: number; failed: number } | null;
    places: { discovered: number; normalized: number; failed: number } | null;
  };
  warningsByCode: Record<string, number>;
  candidates: readonly PreviewCandidateSummary[];
}

// ---------------------------------------------------------------------------
// Fetch + normalize — the only impure part. Everything below this section is
// a pure function of a `PreviewResult` and is unit-testable without SSH/DB.
// ---------------------------------------------------------------------------

function collectEntityPreview<TBundle extends { post: { ID: number } }>(
  bundles: readonly TBundle[],
  normalize: (bundle: TBundle) => NormalizedRecord,
  sourceKeyPrefix: string,
): EntityPreviewResult {
  const records: NormalizedRecord[] = [];
  const failures: PreviewFailure[] = [];

  for (const bundle of bundles) {
    try {
      records.push(normalize(bundle));
    } catch (error) {
      failures.push({
        sourceKey: `${sourceKeyPrefix}:${bundle.post.ID}`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    discovered: bundles.length,
    normalized: records.length,
    failed: failures.length,
    records,
    failures,
  };
}

export async function collectArticlePreview(
  repository: WordPressRepository,
  limit: number | undefined,
): Promise<EntityPreviewResult> {
  const bundles = await repository.getPublishedArticles(limit);
  return collectEntityPreview(bundles, normalizeArticle, "wordpress-db:post");
}

export async function collectPlacePreview(
  repository: WordPressRepository,
  limit: number | undefined,
): Promise<EntityPreviewResult> {
  const bundles = await repository.getPublishedPlaces(limit);
  return collectEntityPreview(bundles, normalizePlace, "wordpress-db:places");
}

export async function collectPreview(
  repository: WordPressRepository,
  entity: PreviewEntity,
  limit: number | undefined,
): Promise<PreviewResult> {
  const [articles, places] = await Promise.all([
    entity === "place" ? Promise.resolve(null) : collectArticlePreview(repository, limit),
    entity === "article" ? Promise.resolve(null) : collectPlacePreview(repository, limit),
  ]);

  return {
    source: "wordpress-db",
    entity,
    limit: limit ?? null,
    generatedAt: new Date().toISOString(),
    articles,
    places,
  };
}

// ---------------------------------------------------------------------------
// Report building — pure, no DB/network access.
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

export function computeWarningsByCode(result: PreviewResult): Record<string, number> {
  const counts: Record<string, number> = {};
  const allRecords = [...(result.articles?.records ?? []), ...(result.places?.records ?? [])];
  for (const record of allRecords) {
    for (const warning of record.warnings ?? []) {
      counts[warning.code] = (counts[warning.code] ?? 0) + 1;
    }
  }
  return counts;
}

/** Never reads `record.normalizedPayload` wholesale — only lifts `title`/`slug`, nothing else. */
function extractTitleSlug(payload: unknown): { title: string | null; slug: string | null } {
  if (typeof payload !== "object" || payload === null) {
    return { title: null, slug: null };
  }
  const candidate = payload as { title?: unknown; slug?: unknown };
  return {
    title: typeof candidate.title === "string" ? candidate.title : null,
    slug: typeof candidate.slug === "string" ? candidate.slug : null,
  };
}

function toCandidateSummary(record: NormalizedRecord): PreviewCandidateSummary {
  const { title, slug } = extractTitleSlug(record.normalizedPayload);
  return {
    sourceRecordKey: record.sourceRecordKey,
    targetTypeHint: record.targetTypeHint,
    title,
    slug,
    warnings: record.warnings ?? [],
    mediaRefs: record.mediaRefs ?? [],
    relationRefs: record.relationRefs ?? [],
  };
}

export function buildPreviewHumanReport(result: PreviewResult): string {
  const lines: string[] = [];
  const push = (line = "") => lines.push(line);

  push("Migration Preview");
  push();
  push(`source: ${result.source}`);
  push(`entity: ${result.entity}`);
  push(`limit: ${result.limit ?? "(default)"}`);
  push();

  if (result.articles) {
    push("Articles:");
    push(`${result.articles.discovered} discovered`);
    push(`${result.articles.normalized} normalized`);
    push(`${result.articles.failed} failed`);
    push();
  }

  if (result.places) {
    push("Places:");
    push(`${result.places.discovered} discovered`);
    push(`${result.places.normalized} normalized`);
    push(`${result.places.failed} failed`);
    push();
  }

  const warningsByCode = computeWarningsByCode(result);
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

  const allRecords = [...(result.articles?.records ?? []), ...(result.places?.records ?? [])];
  push("Sample candidates (first 3)");
  if (allRecords.length === 0) {
    push("(none)");
  } else {
    for (const record of allRecords.slice(0, 3)) {
      const summary = toCandidateSummary(record);
      push(
        `- ${summary.sourceRecordKey} | ${summary.title ?? "(no title)"} | ${summary.slug ?? "(no slug)"} ` +
          `| warnings: ${summary.warnings.length} | mediaRefs: ${summary.mediaRefs.length} | relationRefs: ${summary.relationRefs.length}`,
      );
    }
  }

  return lines.join("\n");
}

function summaryOf(entityResult: EntityPreviewResult | null) {
  if (!entityResult) return null;
  return {
    discovered: entityResult.discovered,
    normalized: entityResult.normalized,
    failed: entityResult.failed,
  };
}

/**
 * JSON report shape. Deliberately excludes `normalizedPayload.content` and
 * `.rawMeta` — only `title`/`slug` are lifted out of the payload — so this
 * never becomes a local dump of WordPress content/postmeta.
 */
export function buildPreviewJsonReport(result: PreviewResult): PreviewJsonReport {
  const allRecords = [...(result.articles?.records ?? []), ...(result.places?.records ?? [])];
  return {
    source: result.source,
    generatedAt: result.generatedAt,
    entity: result.entity,
    limit: result.limit,
    summary: {
      articles: summaryOf(result.articles),
      places: summaryOf(result.places),
    },
    warningsByCode: computeWarningsByCode(result),
    candidates: allRecords.map(toCandidateSummary),
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

async function main(): Promise<void> {
  const { entity, limit, out, allowRemoteReadonly } = parseArgs(process.argv.slice(2));

  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, allowRemoteReadonly);

  const executor = createWordPressSshMysqlExecutor(config);
  const repository = new WordPressRepository(executor);

  const result = await collectPreview(repository, entity, limit);

  console.log(buildPreviewHumanReport(result));

  if (out) {
    writeFileSync(out, JSON.stringify(buildPreviewJsonReport(result), null, 2));
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
