/**
 * Wires WordPressRepository + normalizePlace/normalizeArticle into a real
 * `MigrationAdapter` so the generic Phoenix engine (core/orchestrator.ts)
 * can discover and normalize WordPress content. This module never opens a
 * connection itself — the executor must be injected by the caller via
 * `context.config.executor` — and it is never registered as a side effect
 * of importing it; call `registerWordPressDbAdapter()` explicitly.
 */
import { createHash } from "node:crypto";

import { registerMigrationAdapter } from "../registry";
import { normalizeArticle } from "./normalizeArticle";
import { normalizePlace } from "./normalizePlace";
import { WordPressRepository } from "./WordPressRepository";
import type { WordPressQueryExecutor } from "./WordPressRepository";
import type { WordPressArticleBundle, WordPressPlaceBundle } from "./types";
import type {
  MigrationAdapterContext,
  NormalizedRecord,
  SourceRecordEnvelope,
} from "../../types";

export const WORDPRESS_DB_ADAPTER_KEY = "wordpress-db";
export const ARTICLE_ENTITY_TYPE = "wordpress-db:post";
export const PLACE_ENTITY_TYPE = "wordpress-db:places";

type WordPressEntityFilter = "article" | "place" | "all";

function getExecutorFromContext(context: MigrationAdapterContext): WordPressQueryExecutor {
  const executor = context.config?.executor;
  if (typeof executor !== "function") {
    throw new Error(
      "wordpress-db adapter requires a WordPressQueryExecutor at context.config.executor " +
        "(this adapter never opens a connection itself).",
    );
  }
  return executor as WordPressQueryExecutor;
}

function resolveEntityFilter(context: MigrationAdapterContext): WordPressEntityFilter {
  const entityTypes = context.filters?.entityTypes;
  if (!entityTypes || entityTypes.length === 0) return "all";

  const wantsArticles = entityTypes.includes(ARTICLE_ENTITY_TYPE);
  const wantsPlaces = entityTypes.includes(PLACE_ENTITY_TYPE);
  if (wantsArticles && !wantsPlaces) return "article";
  if (wantsPlaces && !wantsArticles) return "place";
  return "all";
}

// ---------------------------------------------------------------------------
// Deterministic hashing — a plain `JSON.stringify` would depend on object
// key insertion order, which isn't guaranteed stable across code paths that
// build logically-identical bundles differently. Sorting keys removes that
// non-determinism; array order is preserved since it's meaningful there.
// ---------------------------------------------------------------------------

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashBundle(bundle: unknown): string {
  return createHash("sha256").update(stableStringify(bundle)).digest("hex");
}

function toArticleEnvelope(bundle: WordPressArticleBundle): SourceRecordEnvelope {
  const sourceRecordKey = `${ARTICLE_ENTITY_TYPE}:${bundle.post.ID}`;
  return {
    sourceEntityType: ARTICLE_ENTITY_TYPE,
    sourceStableKey: sourceRecordKey,
    sourceRecordKey,
    sourceUpdatedAt: bundle.post.post_modified,
    sourceHash: hashBundle(bundle),
    rawPayload: bundle,
  };
}

function toPlaceEnvelope(bundle: WordPressPlaceBundle): SourceRecordEnvelope {
  const sourceRecordKey = `${PLACE_ENTITY_TYPE}:${bundle.post.ID}`;
  return {
    sourceEntityType: PLACE_ENTITY_TYPE,
    sourceStableKey: sourceRecordKey,
    sourceRecordKey,
    sourceUpdatedAt: bundle.post.post_modified,
    sourceHash: hashBundle(bundle),
    rawPayload: bundle,
  };
}

async function discoverRecords(
  context: MigrationAdapterContext,
): Promise<SourceRecordEnvelope[]> {
  const executor = getExecutorFromContext(context);
  const repository = new WordPressRepository(executor);
  const limit = context.filters?.limit;
  const entityFilter = resolveEntityFilter(context);

  const envelopes: SourceRecordEnvelope[] = [];

  if (entityFilter === "article" || entityFilter === "all") {
    const articles = await repository.getPublishedArticles(limit);
    envelopes.push(...articles.map(toArticleEnvelope));
  }

  if (entityFilter === "place" || entityFilter === "all") {
    const places = await repository.getPublishedPlaces(limit);
    envelopes.push(...places.map(toPlaceEnvelope));
  }

  return envelopes;
}

async function normalizeRecord(record: SourceRecordEnvelope): Promise<NormalizedRecord> {
  if (record.sourceEntityType === ARTICLE_ENTITY_TYPE) {
    return normalizeArticle(record.rawPayload as WordPressArticleBundle);
  }
  if (record.sourceEntityType === PLACE_ENTITY_TYPE) {
    return normalizePlace(record.rawPayload as WordPressPlaceBundle);
  }
  throw new Error(`wordpress-db adapter cannot normalize sourceEntityType "${record.sourceEntityType}"`);
}

export const wordpressDbAdapter = {
  metadata: {
    key: WORDPRESS_DB_ADAPTER_KEY,
    version: "1.0.0",
    displayName: "WordPress DB (read-only)",
    supportedSourceEntityTypes: [ARTICLE_ENTITY_TYPE, PLACE_ENTITY_TYPE],
    supportedTargetTypes: ["ARTICLE", "PLACE"] as const,
    capabilities: ["DISCOVERY", "NORMALIZATION"] as const,
    stableIdPolicy: "WordPress post ID, namespaced by post_type (post/places)",
    hashPolicy:
      "SHA-256 of a key-sorted JSON serialization of the full bundle (post + postmeta + terms + placeIndex)",
    timezonePolicy:
      "wp_posts.post_date/post_modified are carried through as-is, no timezone conversion",
    deletionPolicy: "Not implemented — this adapter is read-only and never deletes anything",
  },
  discoverRecords,
  normalizeRecord,
};

/** No auto-connect and no auto-registration on import — the caller opts in explicitly. */
export function registerWordPressDbAdapter(): void {
  registerMigrationAdapter(wordpressDbAdapter);
}
