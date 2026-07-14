import assert from "node:assert/strict";

import { buildPreviewHumanReport, buildPreviewJsonReport, parseArgs } from "./migration-preview-wordpress-db";
import { getMigrationAdapter } from "../src/lib/migration/adapters/registry";
import {
  ARTICLE_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  ROUTE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { createMigrationRunPlan, runMigrationDryRun } from "../src/lib/migration/core/orchestrator";
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
// Same shape as WordPressRepository.test.ts / wordpressDbAdapter.test.ts.
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

const routePosts: WordPressPostRow[] = [
  post({ ID: 701, post_type: "routes", post_title: "Family Route", post_name: "family-route" }),
];

const postMeta: WordPressPostMetaRow[] = [
  { meta_id: 1, post_id: 201, meta_key: "_thumbnail_id", meta_value: "555" },
  { meta_id: 2, post_id: 202, meta_key: "_elementor_data", meta_value: "[]" },
  { meta_id: 3, post_id: 701, meta_key: "title-location-1", meta_value: "First stop" },
  { meta_id: 4, post_id: 701, meta_key: "description-location-1", meta_value: "First stop note" },
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
      if (postType === "routes") return routePosts as never;
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

if (!getMigrationAdapter(WORDPRESS_DB_ADAPTER_KEY)) {
  registerWordPressDbAdapter();
}

async function buildTestPlan(entityTypes?: readonly string[], limit?: number) {
  const { plan } = await runMigrationDryRun({
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "test",
    sourceConfig: { executor: createFakeExecutor() },
    filters: { entityTypes, limit },
  });
  return plan;
}

async function testEngineProducesCreateItemsForAll() {
  const plan = await buildTestPlan();

  const articleItems = plan.items.filter((item) => item.sourceEntityType === ARTICLE_ENTITY_TYPE);
  const placeItems = plan.items.filter((item) => item.sourceEntityType === PLACE_ENTITY_TYPE);
  const routeItems = plan.items.filter((item) => item.sourceEntityType === ROUTE_ENTITY_TYPE);

  assert.equal(articleItems.length, 2);
  assert.ok(articleItems.every((item) => item.action === "CREATE"));
  assert.equal(placeItems.length, 2);
  assert.ok(placeItems.every((item) => item.action === "CREATE"));
  assert.equal(routeItems.length, 1);
  assert.ok(routeItems.every((item) => item.action === "CREATE"));
  assert.equal(plan.errors.length, 0);
}

async function testEntityFilterAppliesThroughAdapterAndEngine() {
  const articleOnly = await buildTestPlan([ARTICLE_ENTITY_TYPE]);
  assert.ok(articleOnly.items.every((item) => item.sourceEntityType === ARTICLE_ENTITY_TYPE));
  assert.equal(articleOnly.items.length, 2);

  const placeOnly = await buildTestPlan([PLACE_ENTITY_TYPE]);
  assert.ok(placeOnly.items.every((item) => item.sourceEntityType === PLACE_ENTITY_TYPE));
  assert.equal(placeOnly.items.length, 2);

  const routeOnly = await buildTestPlan([ROUTE_ENTITY_TYPE]);
  assert.ok(routeOnly.items.every((item) => item.sourceEntityType === ROUTE_ENTITY_TYPE));
  assert.equal(routeOnly.items.length, 1);
}

async function testStatsPresentAndUsedByReport() {
  const plan = await buildTestPlan();
  assert.ok(plan.stats);

  assert.equal(plan.stats!.discoveredCount, 5);
  assert.equal(plan.stats!.normalizedCount, 5);
  assert.equal(plan.stats!.failedCount, 0);
  assert.deepEqual(plan.stats!.warningCounts, {
    ARTICLE_ELEMENTOR_CONTENT: 1,
    ARTICLE_MISSING_FEATURED_IMAGE: 1,
    PLACE_MISSING_COORDINATES: 1,
  });
  assert.deepEqual(plan.stats!.sourceEntityTypeCounts, {
    [ARTICLE_ENTITY_TYPE]: 2,
    [PLACE_ENTITY_TYPE]: 2,
    [ROUTE_ENTITY_TYPE]: 1,
  });
}

async function testHumanReportContent() {
  const plan = await buildTestPlan();
  const report = buildPreviewHumanReport(plan, { entity: "all", limit: null });

  assert.match(report, /Migration Preview/);
  assert.match(report, /source: wordpress-db/);
  assert.match(report, /entity: all/);
  assert.match(report, /Discovered: 5/);
  assert.match(report, /Normalized: 5/);
  assert.match(report, /Failed: 0/);
  assert.match(report, /Skipped: 0/);
  assert.match(report, /Success rate: 100\.0%/);
  assert.match(report, /Action counts/);
  assert.match(report, /CREATE: 5/);
  assert.match(report, /Target type counts/);
  assert.match(report, /ARTICLE: 2/);
  assert.match(report, /PLACE: 2/);
  assert.match(report, /ROUTE: 1/);
  assert.match(report, /Source entity type counts/);
  assert.match(report, /• 1 Elementor articles/);
  assert.match(report, /• 1 articles without a featured image/);
  assert.match(report, /• 1 places without coordinates/);
  assert.match(report, /Durations \(ms\)/);
  assert.match(report, /discover:/);
  assert.match(report, /normalize:/);
  assert.match(report, /total:/);
  assert.match(report, /Sample candidates \(first 3\)/);
  assert.match(report, /wordpress-db:post:201/);
  assert.match(report, /Plain Article/);
}

async function testHumanReportEntityFilterNarrowsBreakdown() {
  const plan = await buildTestPlan([ARTICLE_ENTITY_TYPE]);
  const report = buildPreviewHumanReport(plan, { entity: "article", limit: null });

  assert.match(report, /Discovered: 2/);
  assert.deepEqual(plan.stats!.sourceEntityTypeCounts, { [ARTICLE_ENTITY_TYPE]: 2 });
  assert.ok(!report.includes(PLACE_ENTITY_TYPE));
}

async function testJsonReportExcludesRawContent() {
  const plan = await buildTestPlan();
  const jsonReport = buildPreviewJsonReport(plan, { entity: "all", limit: null });

  assert.ok(jsonReport.stats);
  assert.equal(jsonReport.stats!.discoveredCount, 5);
  assert.deepEqual(jsonReport.stats!.warningCounts, {
    ARTICLE_ELEMENTOR_CONTENT: 1,
    ARTICLE_MISSING_FEATURED_IMAGE: 1,
    PLACE_MISSING_COORDINATES: 1,
  });
  assert.equal(jsonReport.candidates.length, 5);

  for (const candidate of jsonReport.candidates) {
    assert.ok(!("content" in candidate));
    assert.ok(!("rawMeta" in candidate));
    assert.ok(!("postMeta" in candidate));
    assert.equal(typeof candidate.mediaRefCount, "number");
    assert.equal(typeof candidate.relationRefCount, "number");
  }

  const serialized = JSON.stringify(jsonReport);
  assert.ok(!serialized.includes("<p>content</p>"), "raw post_content must never appear in the JSON report");
  assert.ok(!serialized.includes("rawMeta"), "rawMeta key must never appear in the JSON report");

  const plainArticle = jsonReport.candidates.find((c) => c.sourceRecordKey === "wordpress-db:post:201");
  assert.equal(plainArticle?.title, "Plain Article");
  assert.equal(plainArticle?.slug, "plain-article");
  assert.equal(plainArticle?.targetTypeHint, "ARTICLE");
  assert.equal(plainArticle?.action, "CREATE");

  const locatedPlace = jsonReport.candidates.find((c) => c.sourceRecordKey === "wordpress-db:places:301");
  assert.equal(locatedPlace?.title, "Located Place");
  assert.equal(locatedPlace?.targetTypeHint, "PLACE");
}

async function testNormalizeFailureSurfacesAsFailAction() {
  // A record whose rawPayload doesn't look like a bundle at all still must
  // not crash the whole plan — the engine catches per-record errors.
  const plan = await createMigrationRunPlan({
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "test",
    records: [
      {
        sourceEntityType: ARTICLE_ENTITY_TYPE,
        sourceStableKey: "broken:1",
        sourceRecordKey: "broken:1",
        rawPayload: null,
      },
    ],
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].action, "FAIL");
  assert.equal(plan.items[0].status, "FAILED");
  assert.equal(plan.errors.length, 1);
  assert.equal(plan.errors[0].sourceRecordKey, "broken:1");
}

function testParseArgs() {
  assert.deepEqual(parseArgs([]), {
    entity: "all",
    limit: undefined,
    sourceRecordKey: undefined,
    forceReprocess: false,
    out: undefined,
    allowRemoteReadonly: false,
  });

  assert.deepEqual(parseArgs(["--entity", "place", "--limit", "20"]), {
    entity: "place",
    limit: 20,
    sourceRecordKey: undefined,
    forceReprocess: false,
    out: undefined,
    allowRemoteReadonly: false,
  });

  assert.deepEqual(parseArgs(["--entity", "route"]), {
    entity: "route",
    limit: undefined,
    sourceRecordKey: undefined,
    forceReprocess: false,
    out: undefined,
    allowRemoteReadonly: false,
  });

  assert.deepEqual(parseArgs(["--entity", "article", "--out", "report.json", "--allow-remote-readonly"]), {
    entity: "article",
    limit: undefined,
    sourceRecordKey: undefined,
    forceReprocess: false,
    out: "report.json",
    allowRemoteReadonly: true,
  });

  assert.deepEqual(parseArgs(["--entity", "article", "--source-record-key", "wordpress-db:post:201"]), {
    entity: "article",
    limit: undefined,
    sourceRecordKey: "wordpress-db:post:201",
    forceReprocess: false,
    out: undefined,
    allowRemoteReadonly: false,
  });

  assert.deepEqual(
    parseArgs([
      "--entity",
      "article",
      "--source-record-key",
      "wordpress-db:post:201",
      "--force-reprocess",
    ]),
    {
      entity: "article",
      limit: undefined,
      sourceRecordKey: "wordpress-db:post:201",
      forceReprocess: true,
      out: undefined,
      allowRemoteReadonly: false,
    },
  );

  assert.throws(() => parseArgs(["--entity", "bogus"]), /Invalid --entity value/);
  assert.throws(() => parseArgs(["--limit", "0"]), /Invalid --limit value/);
  assert.throws(() => parseArgs(["--limit", "not-a-number"]), /Invalid --limit value/);
  assert.throws(() => parseArgs(["--source-record-key"]), /Missing value for --source-record-key/);
  assert.throws(() => parseArgs(["--entity", "event", "--force-reprocess"]), /--entity article/);
  assert.throws(() => parseArgs(["--entity", "article", "--force-reprocess"]), /--source-record-key/);
  assert.throws(
    () =>
      parseArgs([
        "--entity",
        "article",
        "--source-record-key",
        "wordpress-db:post:201",
        "--force-reprocess",
        "--limit",
        "2",
      ]),
    /mass mode is not allowed/,
  );
}

async function main() {
  await testEngineProducesCreateItemsForAll();
  await testEntityFilterAppliesThroughAdapterAndEngine();
  await testStatsPresentAndUsedByReport();
  await testHumanReportContent();
  await testHumanReportEntityFilterNarrowsBreakdown();
  await testJsonReportExcludesRawContent();
  await testNormalizeFailureSurfacesAsFailAction();
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
