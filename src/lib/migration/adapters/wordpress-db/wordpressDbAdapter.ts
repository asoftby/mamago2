/**
 * Wires WordPressRepository + normalizePlace/normalizeArticle/normalizeEvent
 * into a real `MigrationAdapter` so the generic Phoenix engine
 * (core/orchestrator.ts) can discover and normalize WordPress content. This
 * module never opens a connection itself — the executor must be injected by
 * the caller via `context.config.executor` — and it is never registered as a
 * side effect of importing it; call `registerWordPressDbAdapter()` explicitly.
 */
import {
  hashArticleBundle,
  hashEventBundle,
  hashPlaceBundle,
  hashRouteBundle,
  hashOfferBundle,
} from "./canonicalSourceHash";
import { registerMigrationAdapter } from "../registry";
import { normalizeArticle } from "./normalizeArticle";
import { normalizeEvent } from "./normalizeEvent";
import { normalizePlace } from "./normalizePlace";
import { normalizeRoute } from "./normalizeRoute";
import { normalizeOffer } from "./normalizeOffer";
import { hashReviewCandidate, normalizeReview } from "./normalizeReview";
import { WordPressRepository } from "./WordPressRepository";
import type { WordPressQueryExecutor } from "./WordPressRepository";
import type {
  WordPressArticleBundle,
  WordPressEventBundle,
  WordPressPlaceBundle,
  WordPressRouteBundle,
  WordPressOfferBundle,
} from "./types";
import type { WordPressVoxelReviewRow } from "./types";
import type {
  MigrationAdapterContext,
  NormalizedRecord,
  SourceRecordEnvelope,
} from "../../types";

export const WORDPRESS_DB_ADAPTER_KEY = "wordpress-db";
export const ARTICLE_ENTITY_TYPE = "wordpress-db:post";
export const PLACE_ENTITY_TYPE = "wordpress-db:places";
export const EVENT_ENTITY_TYPE = "wordpress-db:events";
export const ROUTE_ENTITY_TYPE = "wordpress-db:routes";
export const OFFER_PROGRAMS_ENTITY_TYPE = "wordpress-db:hb-programs";
export const OFFER_SERVICES_ENTITY_TYPE = "wordpress-db:services";
export const REVIEW_ENTITY_TYPE = "wordpress-db:voxel-timeline-review";

type WordPressEntityFilter = "article" | "place" | "event" | "route" | "offer" | "review" | "all";

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

  const wanted = {
    article: entityTypes.includes(ARTICLE_ENTITY_TYPE),
    place: entityTypes.includes(PLACE_ENTITY_TYPE),
    event: entityTypes.includes(EVENT_ENTITY_TYPE),
    route: entityTypes.includes(ROUTE_ENTITY_TYPE),
    offer: entityTypes.includes(OFFER_PROGRAMS_ENTITY_TYPE) || entityTypes.includes(OFFER_SERVICES_ENTITY_TYPE),
    review: entityTypes.includes(REVIEW_ENTITY_TYPE),
  };
  const wantedKeys = (Object.keys(wanted) as (keyof typeof wanted)[]).filter((key) => wanted[key]);
  return wantedKeys.length === 1 ? wantedKeys[0] : "all";
}

function toArticleEnvelope(bundle: WordPressArticleBundle): SourceRecordEnvelope {
  const sourceRecordKey = `${ARTICLE_ENTITY_TYPE}:${bundle.post.ID}`;
  return {
    sourceEntityType: ARTICLE_ENTITY_TYPE,
    sourceStableKey: sourceRecordKey,
    sourceRecordKey,
    sourceUpdatedAt: bundle.post.post_modified,
    sourceHash: hashArticleBundle(bundle),
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
    sourceHash: hashPlaceBundle(bundle),
    rawPayload: bundle,
  };
}

function toEventEnvelope(bundle: WordPressEventBundle): SourceRecordEnvelope {
  const sourceRecordKey = `${EVENT_ENTITY_TYPE}:${bundle.post.ID}`;
  return {
    sourceEntityType: EVENT_ENTITY_TYPE,
    sourceStableKey: sourceRecordKey,
    sourceRecordKey,
    sourceUpdatedAt: bundle.post.post_modified,
    sourceHash: hashEventBundle(bundle),
    rawPayload: bundle,
  };
}

function toRouteEnvelope(bundle: WordPressRouteBundle): SourceRecordEnvelope {
  const sourceRecordKey = `${ROUTE_ENTITY_TYPE}:${bundle.post.ID}`;
  return {
    sourceEntityType: ROUTE_ENTITY_TYPE,
    sourceStableKey: sourceRecordKey,
    sourceRecordKey,
    sourceUpdatedAt: bundle.post.post_modified,
    sourceHash: hashRouteBundle(bundle),
    rawPayload: bundle,
  };
}
function toReviewEnvelope(row: WordPressVoxelReviewRow): SourceRecordEnvelope {
  const sourceRecordKey = `${REVIEW_ENTITY_TYPE}:${row.id}`;
  const normalized = normalizeReview(row);
  const candidate = normalized.normalizedPayload as import("./normalizeReview").NormalizedReviewCandidate;
  return {
    sourceEntityType: REVIEW_ENTITY_TYPE,
    sourceStableKey: sourceRecordKey,
    sourceRecordKey,
    sourceUpdatedAt: row.created_at,
    sourceHash: hashReviewCandidate(candidate),
    rawPayload: row,
  };
}
function toOfferEnvelope(bundle: WordPressOfferBundle): SourceRecordEnvelope {
  const sourceRecordKey = `wordpress-db:${bundle.post.post_type}:${bundle.post.ID}`;
  return { sourceEntityType: `wordpress-db:${bundle.post.post_type}`, sourceStableKey: sourceRecordKey, sourceRecordKey, sourceUpdatedAt: bundle.post.post_modified, sourceHash: hashOfferBundle(bundle), rawPayload: bundle };
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

  if (entityFilter === "event" || entityFilter === "all") {
    const events = await repository.getPublishedEvents(limit);
    envelopes.push(...events.map(toEventEnvelope));
  }

  if (entityFilter === "route" || entityFilter === "all") {
    const routes = await repository.getPublishedRoutes(limit);
    envelopes.push(...routes.map(toRouteEnvelope));
  }
  if (entityFilter === "offer" || entityFilter === "all") {
    const offers = await repository.getPublishedOffers(limit);
    envelopes.push(...offers.map(toOfferEnvelope));
  }
  if (entityFilter === "review" || entityFilter === "all") {
    const reviews = await repository.getVoxelPostReviews(limit);
    envelopes.push(...reviews.map(toReviewEnvelope));
  }

  return envelopes;
}

async function normalizeRecord(record: SourceRecordEnvelope, context?: MigrationAdapterContext): Promise<NormalizedRecord> {
  if (record.sourceEntityType === ARTICLE_ENTITY_TYPE) {
    return normalizeArticle(record.rawPayload as WordPressArticleBundle);
  }
  if (record.sourceEntityType === PLACE_ENTITY_TYPE) {
    return normalizePlace(record.rawPayload as WordPressPlaceBundle);
  }
  if (record.sourceEntityType === EVENT_ENTITY_TYPE) {
    // Real Event past-only exclusion/pruning needs an actual clock — unlike
    // `normalizeEvent()`'s own default (no clock => no pruning, kept only so
    // its unit tests stay deterministic without passing `now`), the adapter
    // boundary is what every real caller (preview/commit CLIs) goes through,
    // so it must never silently skip pruning just because the caller didn't
    // pass `now` explicitly.
    return normalizeEvent(record.rawPayload as WordPressEventBundle, { now: context?.now ?? new Date() });
  }
  if (record.sourceEntityType === ROUTE_ENTITY_TYPE) {
    return normalizeRoute(record.rawPayload as WordPressRouteBundle);
  }
  if (record.sourceEntityType === OFFER_PROGRAMS_ENTITY_TYPE || record.sourceEntityType === OFFER_SERVICES_ENTITY_TYPE) return normalizeOffer(record.rawPayload as WordPressOfferBundle);
  if (record.sourceEntityType === REVIEW_ENTITY_TYPE) return normalizeReview(record.rawPayload as WordPressVoxelReviewRow);
  throw new Error(`wordpress-db adapter cannot normalize sourceEntityType "${record.sourceEntityType}"`);
}

export const wordpressDbAdapter = {
  metadata: {
    key: WORDPRESS_DB_ADAPTER_KEY,
    version: "1.0.0",
    displayName: "WordPress DB (read-only)",
    supportedSourceEntityTypes: [ARTICLE_ENTITY_TYPE, PLACE_ENTITY_TYPE, EVENT_ENTITY_TYPE, ROUTE_ENTITY_TYPE, OFFER_PROGRAMS_ENTITY_TYPE, OFFER_SERVICES_ENTITY_TYPE, REVIEW_ENTITY_TYPE],
    supportedTargetTypes: ["ARTICLE", "PLACE", "ACTIVITY", "ROUTE", "OFFER", "PLACE_REVIEW"] as const,
    capabilities: ["DISCOVERY", "NORMALIZATION"] as const,
    stableIdPolicy: "WordPress post ID, namespaced by post_type (post/places/events)",
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

export async function fetchPublishedOfferEnvelopeBySourceRecordKey(executor: WordPressQueryExecutor, sourceRecordKey: string): Promise<SourceRecordEnvelope> {
  const match = /^wordpress-db:(hb-programs|services):([1-9]\d*)$/.exec(sourceRecordKey.trim());
  if (!match) throw new Error(`Invalid canonical Offer sourceRecordKey "${sourceRecordKey}".`);
  const bundle = await new WordPressRepository(executor).getPublishedOfferById(match[1], Number(match[2]));
  if (!bundle) throw new Error(`No published canonical WordPress Offer found for "${sourceRecordKey}".`);
  return toOfferEnvelope(bundle);
}

export async function fetchPublishedReviewEnvelopeBySourceRecordKey(executor: WordPressQueryExecutor, sourceRecordKey: string): Promise<SourceRecordEnvelope> {
  const match = /^wordpress-db:voxel-timeline-review:([1-9]\d*)$/.exec(sourceRecordKey.trim());
  if (!match) throw new Error(`Invalid Review sourceRecordKey "${sourceRecordKey}".`);
  const row = await new WordPressRepository(executor).getVoxelPostReviewById(Number(match[1]));
  if (!row) throw new Error(`No Voxel post_reviews row found for "${sourceRecordKey}".`);
  return toReviewEnvelope(row);
}

/**
 * Fetches a single published WP article by its Phoenix `sourceRecordKey`
 * (`wordpress-db:post:{id}`). Used by commit/preview CLIs for golden-sample
 * runs that must not discover more than one record.
 */
export async function fetchPublishedArticleEnvelopeBySourceRecordKey(
  executor: WordPressQueryExecutor,
  sourceRecordKey: string,
): Promise<SourceRecordEnvelope> {
  const match = /^wordpress-db:post:(\d+)$/.exec(sourceRecordKey.trim());
  if (!match) {
    throw new Error(
      `Invalid article sourceRecordKey "${sourceRecordKey}". Expected format "wordpress-db:post:{wpPostId}".`,
    );
  }
  const postId = Number(match[1]);
  const repository = new WordPressRepository(executor);
  const bundle = await repository.getPublishedArticleById(postId);
  if (!bundle) {
    throw new Error(
      `No published WordPress article found for sourceRecordKey "${sourceRecordKey}" (post_type=post, post_status=publish).`,
    );
  }
  return toArticleEnvelope(bundle);
}

/**
 * Fetches a single published WP place by its Phoenix `sourceRecordKey`
 * (`wordpress-db:places:{id}`). Used by commit/preview CLIs for targeted
 * single-record runs that must not discover more than one of the 82
 * published Places. Requires a strictly positive integer id — `0` and
 * leading zeros are rejected, not just non-numeric input (route/event/
 * article's equivalents predate this requirement and stay looser; Place's
 * regex is intentionally stricter per the targeted-commit safety review).
 */
export async function fetchPublishedPlaceEnvelopeBySourceRecordKey(
  executor: WordPressQueryExecutor,
  sourceRecordKey: string,
): Promise<SourceRecordEnvelope> {
  const match = /^wordpress-db:places:([1-9]\d*)$/.exec(sourceRecordKey.trim());
  if (!match) {
    throw new Error(
      `Invalid place sourceRecordKey "${sourceRecordKey}". Expected format "wordpress-db:places:{positiveIntegerWpPostId}".`,
    );
  }
  const postId = Number(match[1]);
  const repository = new WordPressRepository(executor);
  const bundle = await repository.getPublishedPlaceById(postId);
  if (!bundle) {
    throw new Error(
      `No published WordPress place found for sourceRecordKey "${sourceRecordKey}" (post_type=places, post_status=publish).`,
    );
  }
  return toPlaceEnvelope(bundle);
}

/**
 * Fetches a single published WP event by its Phoenix `sourceRecordKey`
 * (`wordpress-db:events:{id}`). Used by commit/preview CLIs for golden-sample
 * runs that must not discover more than one record.
 */
export async function fetchPublishedEventEnvelopeBySourceRecordKey(
  executor: WordPressQueryExecutor,
  sourceRecordKey: string,
): Promise<SourceRecordEnvelope> {
  const match = /^wordpress-db:events:(\d+)$/.exec(sourceRecordKey.trim());
  if (!match) {
    throw new Error(
      `Invalid event sourceRecordKey "${sourceRecordKey}". Expected format "wordpress-db:events:{wpPostId}".`,
    );
  }
  const postId = Number(match[1]);
  const repository = new WordPressRepository(executor);
  const bundle = await repository.getPublishedEventById(postId);
  if (!bundle) {
    throw new Error(
      `No published WordPress event found for sourceRecordKey "${sourceRecordKey}" (post_type=events, post_status=publish).`,
    );
  }
  return toEventEnvelope(bundle);
}

/**
 * Fetches a single published WP route by its Phoenix `sourceRecordKey`
 * (`wordpress-db:routes:{id}`). Used by commit/preview CLIs for golden-sample
 * runs that must not discover more than one record.
 */
export async function fetchPublishedRouteEnvelopeBySourceRecordKey(
  executor: WordPressQueryExecutor,
  sourceRecordKey: string,
): Promise<SourceRecordEnvelope> {
  const match = /^wordpress-db:routes:(\d+)$/.exec(sourceRecordKey.trim());
  if (!match) {
    throw new Error(
      `Invalid route sourceRecordKey "${sourceRecordKey}". Expected format "wordpress-db:routes:{wpPostId}".`,
    );
  }
  const postId = Number(match[1]);
  const repository = new WordPressRepository(executor);
  const bundle = await repository.getPublishedRouteById(postId);
  if (!bundle) {
    throw new Error(
      `No published WordPress route found for sourceRecordKey "${sourceRecordKey}" (post_type=routes, post_status=publish).`,
    );
  }
  return toRouteEnvelope(bundle);
}
