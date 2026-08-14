import assert from "node:assert/strict";

import {
  ARTICLE_ENTITY_TYPE,
  EVENT_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  REVIEW_ENTITY_TYPE,
  ROUTE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  fetchPublishedArticleEnvelopeBySourceRecordKey,
  fetchPublishedPlaceEnvelopeBySourceRecordKey,
  wordpressDbAdapter,
} from "./wordpressDbAdapter";
import type {
  WordPressPlaceIndexRow,
  WordPressPostMetaRow,
  WordPressPostRow,
  WordPressTermRow,
} from "./types";
import type { WordPressQueryExecutor } from "./WordPressRepository";
import type { MigrationAdapterContext } from "../../types";

// ---------------------------------------------------------------------------
// Fixtures — no live DB, same fake-executor pattern as WordPressRepository.test.ts.
// ---------------------------------------------------------------------------

function post(overrides: Partial<WordPressPostRow>): WordPressPostRow {
  return {
    ID: 0,
    post_author: 1,
    post_date: "2026-01-01 00:00:00",
    post_content: "<p>content</p>",
    post_title: "Title",
    post_excerpt: "Excerpt",
    post_status: "publish",
    post_name: "slug",
    post_modified: "2026-01-02 00:00:00",
    post_parent: 0,
    guid: "https://example.com",
    post_type: "post",
    post_mime_type: "",
    ...overrides,
  };
}

const articlePosts: WordPressPostRow[] = [
  post({ ID: 201, post_type: "post", post_title: "Article One", post_name: "article-one" }),
];

const placePosts: WordPressPostRow[] = [
  post({ ID: 301, post_type: "places", post_title: "Place One", post_name: "place-one" }),
];

const routePosts: WordPressPostRow[] = [
  post({ ID: 501, post_type: "routes", post_title: "Route One", post_name: "route-one" }),
];

const postMeta: WordPressPostMetaRow[] = [
  { meta_id: 1, post_id: 201, meta_key: "_thumbnail_id", meta_value: "555" },
];

const terms: WordPressTermRow[] = [];

const placeIndexRows: WordPressPlaceIndexRow[] = [
  { post_id: 301, post_status: "publish", priority: 1, lat: 53.9, lng: 27.5667 },
];

function createFakeExecutor(): WordPressQueryExecutor {
  return async (sql, params = []) => {
    if (sql.includes("FROM wp_posts") && sql.includes("post_type = ?")) {
      const [postType, , postId] = params;
      const byId = sql.includes("ID = ?");
      if (postType === "post") {
        if (byId) {
          return articlePosts.filter((row) => row.ID === Number(postId)) as never;
        }
        return articlePosts as never;
      }
      if (postType === "places") {
        if (byId) return placePosts.filter((row) => row.ID === Number(postId)) as never;
        return placePosts as never;
      }
      if (postType === "routes") {
        if (byId) {
          return routePosts.filter((row) => row.ID === Number(postId)) as never;
        }
        return routePosts as never;
      }
      return [] as never;
    }
    if (sql.includes("FROM wp_postmeta")) {
      const ids = params as readonly number[];
      return postMeta.filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("FROM wp_term_relationships")) {
      const ids = params as readonly number[];
      return terms.filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("FROM wp_voxel_index_places")) {
      const ids = params as readonly number[];
      return placeIndexRows.filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("post_type IN (")) {
      return [] as never;
    }
    if (sql.includes("FROM wp_voxel_timeline")) {
      return [] as never;
    }
    throw new Error(`Unexpected query in test fake: ${sql}`);
  };
}

function contextWith(overrides: Partial<MigrationAdapterContext> = {}): MigrationAdapterContext {
  return {
    sourceNamespace: "test",
    config: { executor: createFakeExecutor() },
    ...overrides,
  };
}

async function testDiscoverArticlesOnly() {
  const records = await wordpressDbAdapter.discoverRecords(
    contextWith({ filters: { entityTypes: [ARTICLE_ENTITY_TYPE] } }),
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceEntityType, ARTICLE_ENTITY_TYPE);
}

async function testDiscoverPlacesOnly() {
  const records = await wordpressDbAdapter.discoverRecords(
    contextWith({ filters: { entityTypes: [PLACE_ENTITY_TYPE] } }),
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceEntityType, PLACE_ENTITY_TYPE);
}

async function testDiscoverRoutesOnly() {
  const records = await wordpressDbAdapter.discoverRecords(
    contextWith({ filters: { entityTypes: [ROUTE_ENTITY_TYPE] } }),
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceEntityType, ROUTE_ENTITY_TYPE);
}

async function testDiscoverAll() {
  const records = await wordpressDbAdapter.discoverRecords(contextWith());
  assert.equal(records.length, 3);
}

async function testSourceRecordKeyFormat() {
  const records = await wordpressDbAdapter.discoverRecords(contextWith());
  const article = records.find((r) => r.sourceEntityType === ARTICLE_ENTITY_TYPE);
  const place = records.find((r) => r.sourceEntityType === PLACE_ENTITY_TYPE);
  const route = records.find((r) => r.sourceEntityType === ROUTE_ENTITY_TYPE);
  assert.equal(article?.sourceRecordKey, "wordpress-db:post:201");
  assert.equal(article?.sourceStableKey, "wordpress-db:post:201");
  assert.equal(place?.sourceRecordKey, "wordpress-db:places:301");
  assert.equal(place?.sourceStableKey, "wordpress-db:places:301");
  assert.equal(route?.sourceRecordKey, "wordpress-db:routes:501");
  assert.equal(route?.sourceStableKey, "wordpress-db:routes:501");
}

async function testFetchPublishedArticleEnvelopeBySourceRecordKey() {
  const record = await fetchPublishedArticleEnvelopeBySourceRecordKey(
    createFakeExecutor(),
    "wordpress-db:post:201",
  );

  assert.equal(record.sourceEntityType, ARTICLE_ENTITY_TYPE);
  assert.equal(record.sourceRecordKey, "wordpress-db:post:201");
  assert.equal(record.sourceStableKey, "wordpress-db:post:201");
  assert.equal(record.sourceExternalId, undefined);
  assert.ok(record.sourceHash);
}

async function testFetchPublishedArticleEnvelopeRejectsWrongKey() {
  await assert.rejects(
    () => fetchPublishedArticleEnvelopeBySourceRecordKey(createFakeExecutor(), "wordpress-db:events:201"),
    /Invalid article sourceRecordKey/,
  );
}

async function testFetchPublishedPlaceEnvelopeBySourceRecordKey() {
  const record = await fetchPublishedPlaceEnvelopeBySourceRecordKey(
    createFakeExecutor(),
    "wordpress-db:places:301",
  );

  assert.equal(record.sourceEntityType, PLACE_ENTITY_TYPE);
  assert.equal(record.sourceRecordKey, "wordpress-db:places:301");
  assert.equal(record.sourceStableKey, "wordpress-db:places:301");
  assert.ok(record.sourceHash);
}

/** Wrong entity/post type prefix — an article-shaped key is not a place key. */
async function testFetchPublishedPlaceEnvelopeRejectsWrongEntityPrefix() {
  await assert.rejects(
    () => fetchPublishedPlaceEnvelopeBySourceRecordKey(createFakeExecutor(), "wordpress-db:post:301"),
    /Invalid place sourceRecordKey/,
  );
}

async function testFetchPublishedPlaceEnvelopeRejectsMalformedIds() {
  const cases = [
    "wordpress-db:places:",
    "wordpress-db:places:abc",
    "wordpress-db:places:-1",
    "wordpress-db:places:0",
    "wordpress-db:places:01",
    "wordpress-db:places:1.5",
    "wordpress-db:places:301extra",
    "not-even-a-key",
    "",
  ];
  for (const key of cases) {
    await assert.rejects(
      () => fetchPublishedPlaceEnvelopeBySourceRecordKey(createFakeExecutor(), key),
      /Invalid place sourceRecordKey/,
      `expected "${key}" to be rejected`,
    );
  }
}

async function testFetchPublishedPlaceEnvelopeRejectsMissingSource() {
  await assert.rejects(
    () => fetchPublishedPlaceEnvelopeBySourceRecordKey(createFakeExecutor(), "wordpress-db:places:99999"),
    /No published WordPress place found/,
  );
}


async function testStableSourceHash() {
  const first = await wordpressDbAdapter.discoverRecords(contextWith());
  const second = await wordpressDbAdapter.discoverRecords(contextWith());

  const firstArticle = first.find((r) => r.sourceRecordKey === "wordpress-db:post:201");
  const secondArticle = second.find((r) => r.sourceRecordKey === "wordpress-db:post:201");
  assert.ok(firstArticle?.sourceHash);
  assert.equal(firstArticle?.sourceHash, secondArticle?.sourceHash);

  const place = first.find((r) => r.sourceRecordKey === "wordpress-db:places:301");
  assert.notEqual(firstArticle?.sourceHash, place?.sourceHash);
}

/**
 * Regression for the real bug (2026-07-17): golden Place 895's targeted
 * re-run kept coming back LINKED instead of SKIPPED despite an unchanged
 * source and zero data deltas. Root-caused to `runSshMysqlCommand`
 * decoding each stream chunk independently (fixed in connectExecutor.ts,
 * see `concatBuffersToUtf8`) — not row/key ordering, which this test
 * confirms was already stable: `stableStringify` (wordpressDbAdapter.ts)
 * sorts postMeta's object keys, so feeding the exact same meta rows in a
 * different SQL/array order must still produce an identical sourceHash.
 */
function createFakeExecutorWithReorderedPlaceMeta(reversed: boolean): WordPressQueryExecutor {
  const placeMetaRows: WordPressPostMetaRow[] = [
    { meta_id: 10, post_id: 301, meta_key: "location", meta_value: '{"address":"Test St 1"}' },
    { meta_id: 11, post_id: 301, meta_key: "phone", meta_value: "+375291234567" },
    { meta_id: 12, post_id: 301, meta_key: "city-place", meta_value: "Минск" },
  ];
  const orderedRows = reversed ? [...placeMetaRows].reverse() : placeMetaRows;

  return async (sql, params = []) => {
    if (sql.includes("FROM wp_posts") && sql.includes("post_type = ?")) {
      const [postType, , postId] = params;
      const byId = sql.includes("ID = ?");
      if (postType === "places") {
        return (byId ? placePosts.filter((row) => row.ID === Number(postId)) : placePosts) as never;
      }
      return [] as never;
    }
    if (sql.includes("FROM wp_postmeta")) {
      const ids = params as readonly number[];
      return orderedRows.filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("FROM wp_term_relationships")) {
      return [] as never;
    }
    if (sql.includes("FROM wp_voxel_index_places")) {
      const ids = params as readonly number[];
      return placeIndexRows.filter((row) => ids.includes(row.post_id)) as never;
    }
    throw new Error(`Unexpected query in test fake: ${sql}`);
  };
}

async function testSourceHashStableAcrossPostMetaRowOrder() {
  const forward = await fetchPublishedPlaceEnvelopeBySourceRecordKey(
    createFakeExecutorWithReorderedPlaceMeta(false),
    "wordpress-db:places:301",
  );
  const reversed = await fetchPublishedPlaceEnvelopeBySourceRecordKey(
    createFakeExecutorWithReorderedPlaceMeta(true),
    "wordpress-db:places:301",
  );

  assert.ok(forward.sourceHash);
  assert.equal(
    forward.sourceHash,
    reversed.sourceHash,
    "identical postmeta rows in a different SQL/array order must hash identically",
  );
}

async function testNormalizeRoutesToArticleAndPlace() {
  const records = await wordpressDbAdapter.discoverRecords(contextWith());
  const article = records.find((r) => r.sourceEntityType === ARTICLE_ENTITY_TYPE)!;
  const place = records.find((r) => r.sourceEntityType === PLACE_ENTITY_TYPE)!;

  const normalizedArticle = await wordpressDbAdapter.normalizeRecord(article);
  assert.equal(normalizedArticle.targetTypeHint, "ARTICLE");
  assert.equal(normalizedArticle.sourceRecordKey, "wordpress-db:post:201");

  const normalizedPlace = await wordpressDbAdapter.normalizeRecord(place);
  assert.equal(normalizedPlace.targetTypeHint, "PLACE");
  assert.equal(normalizedPlace.sourceRecordKey, "wordpress-db:places:301");
}

async function testNormalizeRouteEntity() {
  const records = await wordpressDbAdapter.discoverRecords(contextWith());
  const route = records.find((r) => r.sourceEntityType === ROUTE_ENTITY_TYPE)!;

  const normalizedRoute = await wordpressDbAdapter.normalizeRecord(route);
  assert.equal(normalizedRoute.targetTypeHint, "ROUTE");
  assert.equal(normalizedRoute.sourceRecordKey, "wordpress-db:routes:501");
}

async function testNormalizeUnknownEntityTypeThrows() {
  await assert.rejects(
    () =>
      wordpressDbAdapter.normalizeRecord({
        sourceEntityType: "wordpress-db:unknown",
        sourceStableKey: "x",
        sourceRecordKey: "x",
        rawPayload: {},
      }),
    /cannot normalize/,
  );
}

async function testMissingExecutorThrows() {
  await assert.rejects(
    () => wordpressDbAdapter.discoverRecords({ sourceNamespace: "test" }),
    /requires a WordPressQueryExecutor/,
  );
}

async function testMetadata() {
  assert.equal(wordpressDbAdapter.metadata.key, WORDPRESS_DB_ADAPTER_KEY);
  assert.deepEqual(
    [...wordpressDbAdapter.metadata.supportedSourceEntityTypes],
    [ARTICLE_ENTITY_TYPE, PLACE_ENTITY_TYPE, EVENT_ENTITY_TYPE, ROUTE_ENTITY_TYPE, "wordpress-db:hb-programs", "wordpress-db:services", REVIEW_ENTITY_TYPE],
  );
  assert.ok(wordpressDbAdapter.metadata.supportedTargetTypes.includes("ROUTE"));
  assert.ok(wordpressDbAdapter.metadata.supportedTargetTypes.includes("OFFER"));
  assert.ok(wordpressDbAdapter.metadata.supportedTargetTypes.includes("PLACE_REVIEW"));
}

async function main() {
  await testDiscoverArticlesOnly();
  await testDiscoverPlacesOnly();
  await testDiscoverRoutesOnly();
  await testDiscoverAll();
  await testSourceRecordKeyFormat();
  await testFetchPublishedArticleEnvelopeBySourceRecordKey();
  await testFetchPublishedArticleEnvelopeRejectsWrongKey();
  await testFetchPublishedPlaceEnvelopeBySourceRecordKey();
  await testFetchPublishedPlaceEnvelopeRejectsWrongEntityPrefix();
  await testFetchPublishedPlaceEnvelopeRejectsMalformedIds();
  await testFetchPublishedPlaceEnvelopeRejectsMissingSource();
  await testStableSourceHash();
  await testSourceHashStableAcrossPostMetaRowOrder();
  await testNormalizeRoutesToArticleAndPlace();
  await testNormalizeRouteEntity();
  await testNormalizeUnknownEntityTypeThrows();
  await testMissingExecutorThrows();
  await testMetadata();
}

main()
  .then(() => {
    console.log("wordpressDbAdapter tests: OK");
  })
  .catch((error) => {
    console.error("wordpressDbAdapter tests: FAILED", error);
    process.exitCode = 1;
  });
