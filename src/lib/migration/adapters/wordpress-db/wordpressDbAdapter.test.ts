import assert from "node:assert/strict";

import {
  ARTICLE_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
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
      const [postType] = params;
      if (postType === "post") return articlePosts as never;
      if (postType === "places") return placePosts as never;
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

async function testDiscoverAll() {
  const records = await wordpressDbAdapter.discoverRecords(contextWith());
  assert.equal(records.length, 2);
}

async function testSourceRecordKeyFormat() {
  const records = await wordpressDbAdapter.discoverRecords(contextWith());
  const article = records.find((r) => r.sourceEntityType === ARTICLE_ENTITY_TYPE);
  const place = records.find((r) => r.sourceEntityType === PLACE_ENTITY_TYPE);
  assert.equal(article?.sourceRecordKey, "wordpress-db:post:201");
  assert.equal(article?.sourceStableKey, "wordpress-db:post:201");
  assert.equal(place?.sourceRecordKey, "wordpress-db:places:301");
  assert.equal(place?.sourceStableKey, "wordpress-db:places:301");
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
    [ARTICLE_ENTITY_TYPE, PLACE_ENTITY_TYPE],
  );
}

async function main() {
  await testDiscoverArticlesOnly();
  await testDiscoverPlacesOnly();
  await testDiscoverAll();
  await testSourceRecordKeyFormat();
  await testStableSourceHash();
  await testNormalizeRoutesToArticleAndPlace();
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
