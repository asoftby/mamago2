import assert from "node:assert/strict";

import {
  buildPreviewHumanReport,
  buildPreviewJsonReport,
  collectPreview,
  computeWarningsByCode,
  parseArgs,
} from "./migration-preview-wordpress-db";
import { WordPressRepository } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import type {
  WordPressPlaceIndexRow,
  WordPressPostMetaRow,
  WordPressPostRow,
  WordPressTermRow,
} from "../src/lib/migration/adapters/wordpress-db/types";
import type { WordPressQueryExecutor } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";

// ---------------------------------------------------------------------------
// Fixtures: 2 articles (one plain, one with Elementor + no featured image)
// and 2 places (one with coordinates, one without) — no live DB involved.
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
  post({ ID: 201, post_type: "post", post_title: "Plain Article", post_name: "plain-article" }),
  post({ ID: 202, post_type: "post", post_title: "Elementor Article", post_name: "elementor-article" }),
];

const placePosts: WordPressPostRow[] = [
  post({ ID: 301, post_type: "places", post_title: "Located Place", post_name: "located-place" }),
  post({ ID: 302, post_type: "places", post_title: "Unlocated Place", post_name: "unlocated-place" }),
];

const postMeta: WordPressPostMetaRow[] = [
  { meta_id: 1, post_id: 201, meta_key: "_thumbnail_id", meta_value: "555" },
  { meta_id: 2, post_id: 202, meta_key: "_elementor_data", meta_value: "[]" },
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

async function testCollectPreviewAll() {
  const repository = new WordPressRepository(createFakeExecutor());
  const result = await collectPreview(repository, "all", undefined);

  assert.equal(result.articles?.discovered, 2);
  assert.equal(result.articles?.normalized, 2);
  assert.equal(result.articles?.failed, 0);

  assert.equal(result.places?.discovered, 2);
  assert.equal(result.places?.normalized, 2);
  assert.equal(result.places?.failed, 0);
}

async function testCollectPreviewSingleEntity() {
  const repository = new WordPressRepository(createFakeExecutor());

  const articleOnly = await collectPreview(repository, "article", undefined);
  assert.ok(articleOnly.articles);
  assert.equal(articleOnly.places, null);

  const placeOnly = await collectPreview(repository, "place", undefined);
  assert.equal(placeOnly.articles, null);
  assert.ok(placeOnly.places);
}

async function testWarningsGroupedByCode() {
  const repository = new WordPressRepository(createFakeExecutor());
  const result = await collectPreview(repository, "all", undefined);

  const warningsByCode = computeWarningsByCode(result);
  assert.deepEqual(warningsByCode, {
    ARTICLE_ELEMENTOR_CONTENT: 1,
    ARTICLE_MISSING_FEATURED_IMAGE: 1,
    PLACE_MISSING_COORDINATES: 1,
  });
}

async function testHumanReportContent() {
  const repository = new WordPressRepository(createFakeExecutor());
  const result = await collectPreview(repository, "all", undefined);
  const report = buildPreviewHumanReport(result);

  assert.match(report, /Migration Preview/);
  assert.match(report, /source: wordpress-db/);
  assert.match(report, /entity: all/);
  assert.match(report, /Articles:\n2 discovered\n2 normalized\n0 failed/);
  assert.match(report, /Places:\n2 discovered\n2 normalized\n0 failed/);
  assert.match(report, /• 1 Elementor articles/);
  assert.match(report, /• 1 articles without a featured image/);
  assert.match(report, /• 1 places without coordinates/);
  assert.match(report, /Sample candidates \(first 3\)/);
  assert.match(report, /wordpress-db:post:201/);
  assert.match(report, /Plain Article/);
}

async function testJsonReportExcludesRawContent() {
  const repository = new WordPressRepository(createFakeExecutor());
  const result = await collectPreview(repository, "all", undefined);
  const jsonReport = buildPreviewJsonReport(result);

  assert.equal(jsonReport.summary.articles?.discovered, 2);
  assert.equal(jsonReport.summary.places?.discovered, 2);
  assert.deepEqual(jsonReport.warningsByCode, {
    ARTICLE_ELEMENTOR_CONTENT: 1,
    ARTICLE_MISSING_FEATURED_IMAGE: 1,
    PLACE_MISSING_COORDINATES: 1,
  });
  assert.equal(jsonReport.candidates.length, 4);

  for (const candidate of jsonReport.candidates) {
    assert.ok(!("content" in candidate));
    assert.ok(!("rawMeta" in candidate));
    assert.ok(!("postMeta" in candidate));
  }

  const serialized = JSON.stringify(jsonReport);
  assert.ok(!serialized.includes("<p>content</p>"), "raw post_content must never appear in the JSON report");
  assert.ok(!serialized.includes("rawMeta"), "rawMeta key must never appear in the JSON report");

  const plainArticle = jsonReport.candidates.find((c) => c.sourceRecordKey === "wordpress-db:post:201");
  assert.equal(plainArticle?.title, "Plain Article");
  assert.equal(plainArticle?.slug, "plain-article");
  assert.equal(plainArticle?.targetTypeHint, "ARTICLE");

  const locatedPlace = jsonReport.candidates.find((c) => c.sourceRecordKey === "wordpress-db:places:301");
  assert.equal(locatedPlace?.title, "Located Place");
  assert.equal(locatedPlace?.targetTypeHint, "PLACE");
}

function testParseArgs() {
  assert.deepEqual(parseArgs([]), {
    entity: "all",
    limit: undefined,
    out: undefined,
    allowRemoteReadonly: false,
  });

  assert.deepEqual(parseArgs(["--entity", "place", "--limit", "20"]), {
    entity: "place",
    limit: 20,
    out: undefined,
    allowRemoteReadonly: false,
  });

  assert.deepEqual(parseArgs(["--entity", "article", "--out", "report.json", "--allow-remote-readonly"]), {
    entity: "article",
    limit: undefined,
    out: "report.json",
    allowRemoteReadonly: true,
  });

  assert.throws(() => parseArgs(["--entity", "bogus"]), /Invalid --entity value/);
  assert.throws(() => parseArgs(["--limit", "0"]), /Invalid --limit value/);
  assert.throws(() => parseArgs(["--limit", "not-a-number"]), /Invalid --limit value/);
}

async function main() {
  await testCollectPreviewAll();
  await testCollectPreviewSingleEntity();
  await testWarningsGroupedByCode();
  await testHumanReportContent();
  await testJsonReportExcludesRawContent();
  testParseArgs();
}

main()
  .then(() => {
    console.log("migration-preview-wordpress-db tests: OK");
  })
  .catch((error) => {
    console.error("migration-preview-wordpress-db tests: FAILED", error);
    process.exitCode = 1;
  });
