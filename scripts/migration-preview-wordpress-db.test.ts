import assert from "node:assert/strict";

import {
  buildPreviewHumanReport,
  buildPreviewJsonReport,
  parseArgs,
  applyStateAwarePlacePreview,
  includesPlacePreview,
} from "./migration-preview-wordpress-db";
import { getMigrationAdapter } from "../src/lib/migration/adapters/registry";
import {
  ARTICLE_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  ROUTE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { createMigrationRunPlan, runMigrationDryRun } from "../src/lib/migration/core/orchestrator";
import type { MigrationLineage, Place } from "@prisma/client";
import type {
  WordPressPlaceIndexRow,
  WordPressPostMetaRow,
  WordPressPostRow,
  WordPressTermRow,
} from "../src/lib/migration/adapters/wordpress-db/types";
import type { WordPressQueryExecutor } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import type { MigrationPlan, MigrationPlanItem } from "../src/lib/migration/types";

// ---------------------------------------------------------------------------
// Fixtures: 2 articles (one plain, one with empty leftover Elementor JSON + no featured image)
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
  { meta_id: 5, post_id: 301, meta_key: "cover", meta_value: "1001" },
  { meta_id: 6, post_id: 301, meta_key: "gallery", meta_value: "1002,1003" },
  { meta_id: 7, post_id: 301, meta_key: "location", meta_value: "{\"address\":\"Minsk, Test 1\"}" },
  { meta_id: 8, post_id: 301, meta_key: "city-place", meta_value: "Minsk" },
];

const terms: WordPressTermRow[] = [
  { post_id: 301, term_id: 9001, taxonomy: "place-category", name: "Cafe", slug: "cafe" },
];

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
    if (sql.includes("post_type IN (")) {
      return [] as never;
    }
    if (sql.includes("FROM wp_voxel_timeline")) {
      return [] as never;
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

function lineageRow(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lineage-1",
    sourceId: "source-1",
    recordId: "record-1",
    runId: "run-1",
    sourceEntityType: PLACE_ENTITY_TYPE,
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:places:301",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-1",
    targetRole: "primary",
    targetNaturalKey: null,
    lastSourceHash: "hash-old",
    lastPlanAction: null,
    isActive: true,
    firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSeenAt: null,
    lastImportedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as MigrationLineage;
}

function placeRow(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as unknown as Place;
}

async function testLedgerSameHashPlansSkipUnchanged() {
  const createPlan = await buildTestPlan([PLACE_ENTITY_TYPE], 1);
  const sourceHash = createPlan.records[0].sourceHash;
  assert.ok(sourceHash, "fixture Place must carry a sourceHash");

  const { plan } = await runMigrationDryRun({
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "test",
    sourceConfig: { executor: createFakeExecutor() },
    filters: { entityTypes: [PLACE_ENTITY_TYPE], limit: 1 },
    ledger: {
      findLineageBySourceRecordKeys: async () =>
        new Map([["wordpress-db:places:301", [lineageRow({ lastSourceHash: sourceHash })]]]),
    },
  });

  assert.equal(plan.items[0].action, "SKIP_UNCHANGED");
  assert.equal(plan.items[0].status, "SKIPPED");
}

async function testLedgerChangedHashPlansUpdateAndSafePreviewKeepsUpdate() {
  const { plan: rawPlan } = await runMigrationDryRun({
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "test",
    sourceConfig: { executor: createFakeExecutor() },
    filters: { entityTypes: [PLACE_ENTITY_TYPE], limit: 1 },
    ledger: {
      findLineageBySourceRecordKeys: async () =>
        new Map([["wordpress-db:places:301", [lineageRow({ lastSourceHash: "different-hash" })]]]),
    },
  });

  assert.equal(rawPlan.items[0].action, "UPDATE");

  const postProcessed = await applyStateAwarePlacePreview({
    plan: rawPlan,
    sourceId: "source-1",
    prisma: {
      migrationLineage: { findFirst: async () => lineageRow({ lastSourceHash: "different-hash" }) },
      place: { findUnique: async () => placeRow() },
    },
  });

  assert.equal(postProcessed.items[0].action, "UPDATE");
  assert.equal(postProcessed.items[0].status, "PLANNED");
  assert.equal(postProcessed.items[0].summary?.targetId, "place-1");
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

/**
 * `buildPreviewHumanReport`/`buildPreviewJsonReport` are pure functions of
 * a `MigrationPlan` — a hand-built Event `MigrationPlanItem` (the same
 * `summary` shape `toNormalizedItem()` in `core/orchestrator.ts` now
 * produces for ACTIVITY items) is enough to test the report layer without
 * a full WordPress Event postmeta fixture through the adapter.
 */
function eventPlanFixture(): MigrationPlan {
  const item: MigrationPlanItem = {
    sourceRecordKey: "wordpress-db:events:60404",
    sourceEntityType: "wordpress-db:events",
    action: "CREATE",
    status: "PLANNED",
    targetType: "ACTIVITY",
    summary: {
      title: "Актив Полис",
      slug: "aktiv-polis",
      mediaRefCount: 0,
      relationRefCount: 0,
      rawRangeCount: 3,
      boundaryDateCount: 6,
      sessionCount: 36,
      firstSessionDate: "2026-07-20",
      lastSessionDate: "2026-08-24",
    },
    warnings: [],
  };
  return {
    adapterKey: "wordpress-db",
    adapterVersion: "1",
    sourceNamespace: "wordpress-db",
    mode: "PREVIEW",
    createdAt: new Date().toISOString(),
    records: [],
    items: [item],
    warnings: [],
    errors: [],
    stats: {
      discoveredCount: 1,
      plannedCount: 1,
      normalizedCount: 1,
      failedCount: 0,
      skippedCount: 0,
      successRate: 1,
      actionCounts: { CREATE: 1 },
      statusCounts: { PLANNED: 1 },
      targetTypeCounts: { ACTIVITY: 1 },
      sourceEntityTypeCounts: { "wordpress-db:events": 1 },
      warningCounts: {},
      durationsMs: { discover: 0, filter: 0, normalize: 0, plan: 0, total: 0 },
    },
  };
}

function testHumanReportShowsMaterializedSessionCountForEvents() {
  const report = buildPreviewHumanReport(eventPlanFixture(), { entity: "event", limit: null });

  assert.match(report, /sessions: 36 \(raw ranges: 3, boundary dates: 6\)/);
  assert.match(report, /range: 2026-07-20 -> 2026-08-24/);
  assert.ok(
    !report.includes("sessions: 6 "),
    "the boundary-date count (6) must never be reported as the session count",
  );
}

function testJsonReportIncludesMaterializedSessionFields() {
  const jsonReport = buildPreviewJsonReport(eventPlanFixture(), { entity: "event", limit: null });
  const candidate = jsonReport.candidates[0];

  assert.equal(candidate.sessionCount, 36);
  assert.equal(candidate.rawRangeCount, 3);
  assert.equal(candidate.boundaryDateCount, 6);
  assert.equal(candidate.firstSessionDate, "2026-07-20");
  assert.equal(candidate.lastSessionDate, "2026-08-24");
}

/**
 * `buildScheduleDraft()` in `normalizeEvent.ts` emits a `scheduleItems`
 * entry for an ordinary one-time event too, just without a `dateEnd` — the
 * P2 regression this fixture guards: that must never render as
 * "raw ranges: 1" in either report.
 */
function singleDateEventPlanFixture(): MigrationPlan {
  const item: MigrationPlanItem = {
    sourceRecordKey: "wordpress-db:events:56226",
    sourceEntityType: "wordpress-db:events",
    action: "CREATE",
    status: "PLANNED",
    targetType: "ACTIVITY",
    summary: {
      title: "Игра",
      slug: "igra",
      mediaRefCount: 0,
      relationRefCount: 0,
      rawRangeCount: 0,
      boundaryDateCount: 1,
      sessionCount: 1,
      firstSessionDate: "2026-08-01",
      lastSessionDate: "2026-08-01",
    },
    warnings: [],
  };
  return {
    ...eventPlanFixture(),
    items: [item],
    stats: {
      ...eventPlanFixture().stats!,
      sourceEntityTypeCounts: { "wordpress-db:events": 1 },
    },
  };
}

function testHumanReportSingleDateEventNeverShowsAsARange() {
  const report = buildPreviewHumanReport(singleDateEventPlanFixture(), { entity: "event", limit: null });

  assert.match(report, /sessions: 1 \(raw ranges: 0, boundary dates: 1\)/);
  assert.ok(!report.includes("raw ranges: 1"), "a single-date event's own scheduleItems entry must never be counted as a range");
}

function testJsonReportSingleDateEventHasZeroRawRangeCount() {
  const jsonReport = buildPreviewJsonReport(singleDateEventPlanFixture(), { entity: "event", limit: null });
  const candidate = jsonReport.candidates[0];

  assert.equal(candidate.rawRangeCount, 0);
  assert.equal(candidate.sessionCount, 1);
}

async function testJsonReportExcludesRawContent() {
  const plan = await buildTestPlan();
  const jsonReport = buildPreviewJsonReport(plan, { entity: "all", limit: null });

  assert.ok(jsonReport.stats);
  assert.equal(jsonReport.stats!.discoveredCount, 5);
  assert.deepEqual(jsonReport.stats!.warningCounts, {
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
  assert.equal(locatedPlace?.mediaRefCount, 3);
  assert.equal(locatedPlace?.addressSummary, "Minsk, Test 1");
  assert.equal(locatedPlace?.hasCity, true);
  assert.equal(locatedPlace?.hasCategory, true);
  assert.equal(locatedPlace?.hasCoordinates, true);
}

function planItemFixture(overrides: Partial<MigrationPlanItem> = {}): MigrationPlanItem {
  return {
    sourceRecordKey: "wordpress-db:places:301",
    sourceEntityType: PLACE_ENTITY_TYPE,
    targetType: "PLACE",
    action: "UPDATE",
    status: "PLANNED",
    summary: {
      title: "Located Place",
      slug: "located-place",
      mediaRefCount: 1,
      relationRefCount: 0,
      addressSummary: "Minsk, Test 1",
      hasCity: true,
      hasCategory: true,
      hasCoordinates: true,
    },
    warnings: [],
    ...overrides,
  };
}

function planFixture(items: readonly MigrationPlanItem[]): MigrationPlan {
  return {
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    adapterVersion: "test",
    sourceNamespace: "test",
    mode: "DRY_RUN",
    createdAt: "2026-07-18T00:00:00.000Z",
    records: [],
    items,
    warnings: [],
    errors: [],
    stats: {
      discoveredCount: items.length,
      plannedCount: items.length,
      normalizedCount: items.length,
      failedCount: 0,
      skippedCount: 0,
      successRate: 1,
      actionCounts: { UPDATE: items.length },
      statusCounts: { PLANNED: items.length },
      targetTypeCounts: { PLACE: items.length },
      sourceEntityTypeCounts: { [PLACE_ENTITY_TYPE]: items.length },
      warningCounts: {},
      durationsMs: { discover: 0, filter: 0, normalize: 0, plan: 0, total: 0 },
    },
  };
}

async function testPreviewConflictDoesNotRequireWriteDelegatesAndSerializesSafeFields() {
  const plan = planFixture([planItemFixture()]);
  const processed = await applyStateAwarePlacePreview({
    plan,
    sourceId: "source-1",
    prisma: {
      migrationLineage: { findFirst: async () => lineageRow({ lastImportedAt: null }) },
      place: { findUnique: async () => placeRow() },
    },
  });

  assert.equal(processed.items[0].action, "UPDATE_CONFLICT");
  assert.equal(processed.items[0].status, "BLOCKED");
  assert.equal(processed.items[0].summary?.targetId, "place-1");
  assert.equal(processed.items[0].summary?.conflictReason, "LAST_IMPORTED_AT_UNKNOWN");
  assert.deepEqual(processed.stats?.actionCounts, { UPDATE_CONFLICT: 1 });

  const jsonReport = buildPreviewJsonReport(processed, { entity: "place", limit: null });
  assert.equal(jsonReport.candidates[0].targetId, "place-1");
  assert.equal(jsonReport.candidates[0].conflictReason, "LAST_IMPORTED_AT_UNKNOWN");
  assert.equal(jsonReport.candidates[0].mediaPolicy, "METADATA");
  assert.equal(jsonReport.candidates[0].plannedMediaAction, "METADATA_ONLY");

  const serialized = JSON.stringify(jsonReport);
  assert.ok(!serialized.includes("normalizedPayload"));
  assert.ok(!serialized.includes("rawMeta"));
}

async function testPreviewTargetRowMissingConflict() {
  const processed = await applyStateAwarePlacePreview({
    plan: planFixture([planItemFixture()]),
    sourceId: "source-1",
    prisma: {
      migrationLineage: { findFirst: async () => lineageRow({ targetId: "missing-place" }) },
      place: { findUnique: async () => null },
    },
  });

  assert.equal(processed.items[0].action, "UPDATE_CONFLICT");
  assert.equal(processed.items[0].summary?.targetId, "missing-place");
  assert.equal(processed.items[0].summary?.conflictReason, "TARGET_ROW_MISSING");
}

async function testPreviewTargetModifiedAfterImportConflict() {
  const processed = await applyStateAwarePlacePreview({
    plan: planFixture([planItemFixture()]),
    sourceId: "source-1",
    prisma: {
      migrationLineage: { findFirst: async () => lineageRow({ targetId: "place-1" }) },
      place: { findUnique: async () => placeRow({ updatedAt: new Date("2026-01-02T00:00:00.000Z") }) },
    },
  });

  assert.equal(processed.items[0].action, "UPDATE_CONFLICT");
  assert.equal(processed.items[0].summary?.conflictReason, "TARGET_MODIFIED_AFTER_IMPORT");
}

async function testAllEntityPreviewEnablesStateAwarePlaceDependency() {
  assert.equal(includesPlacePreview("place"), true);
  assert.equal(includesPlacePreview("all"), true);
  assert.equal(includesPlacePreview("article"), false);
  assert.equal(includesPlacePreview("event"), false);
  assert.equal(includesPlacePreview("route"), false);
}

async function testMixedPlanPlaceSkipUnchangedAndNonPlaceUnchanged() {
  const placeItem = planItemFixture({
    sourceRecordKey: "wordpress-db:places:301",
    action: "SKIP_UNCHANGED",
    status: "SKIPPED",
  });
  const articleItem = planItemFixture({
    sourceRecordKey: "wordpress-db:post:201",
    sourceEntityType: ARTICLE_ENTITY_TYPE,
    targetType: "ARTICLE",
    action: "CREATE",
    status: "PLANNED",
    summary: { title: "Plain Article", slug: "plain-article", mediaRefCount: 0, relationRefCount: 0 },
  });

  const processed = await applyStateAwarePlacePreview({
    plan: planFixture([placeItem, articleItem]),
    sourceId: "source-1",
    prisma: {
      migrationLineage: { findFirst: async () => null },
      place: { findUnique: async () => null },
    },
  });

  const byKey = new Map(processed.items.map((item) => [item.sourceRecordKey, item]));
  assert.equal(byKey.get("wordpress-db:places:301")?.action, "SKIP_UNCHANGED");
  assert.equal(byKey.get("wordpress-db:places:301")?.summary?.mediaPolicy, "METADATA");
  assert.equal(byKey.get("wordpress-db:post:201")?.action, "CREATE");
  assert.equal(byKey.get("wordpress-db:post:201")?.summary?.mediaPolicy, undefined);
  assert.deepEqual(byKey.get("wordpress-db:post:201"), articleItem);
}

async function testMixedPlanSafePlaceUpdateUsesClassifierAndNonPlaceUnchanged() {
  const articleItem = planItemFixture({
    sourceRecordKey: "wordpress-db:post:201",
    sourceEntityType: ARTICLE_ENTITY_TYPE,
    targetType: "ARTICLE",
    action: "UPDATE",
    status: "PLANNED",
    summary: { title: "Plain Article", slug: "plain-article", mediaRefCount: 0, relationRefCount: 0 },
  });
  const processed = await applyStateAwarePlacePreview({
    plan: planFixture([planItemFixture({ action: "UPDATE" }), articleItem]),
    sourceId: "source-1",
    prisma: {
      migrationLineage: { findFirst: async () => lineageRow({ targetId: "place-1" }) },
      place: { findUnique: async () => placeRow({ id: "place-1" }) },
    },
  });

  const byKey = new Map(processed.items.map((item) => [item.sourceRecordKey, item]));
  assert.equal(byKey.get("wordpress-db:places:301")?.action, "UPDATE");
  assert.equal(byKey.get("wordpress-db:places:301")?.summary?.targetId, "place-1");
  assert.equal(byKey.get("wordpress-db:post:201"), articleItem);
}

async function testMixedPlanUnsafePlaceUpdateBecomesConflictAndNonPlaceUnchanged() {
  const routeItem = planItemFixture({
    sourceRecordKey: "wordpress-db:routes:701",
    sourceEntityType: ROUTE_ENTITY_TYPE,
    targetType: "ROUTE",
    action: "CREATE",
    status: "PLANNED",
    summary: { title: "Family Route", slug: "family-route", mediaRefCount: 0, relationRefCount: 0 },
  });
  const processed = await applyStateAwarePlacePreview({
    plan: planFixture([planItemFixture({ action: "UPDATE" }), routeItem]),
    sourceId: "source-1",
    prisma: {
      migrationLineage: { findFirst: async () => lineageRow({ targetId: "place-1", lastImportedAt: null }) },
      place: { findUnique: async () => placeRow({ id: "place-1" }) },
    },
  });

  const byKey = new Map(processed.items.map((item) => [item.sourceRecordKey, item]));
  assert.equal(byKey.get("wordpress-db:places:301")?.action, "UPDATE_CONFLICT");
  assert.equal(byKey.get("wordpress-db:places:301")?.status, "BLOCKED");
  assert.equal(byKey.get("wordpress-db:places:301")?.summary?.targetId, "place-1");
  assert.equal(byKey.get("wordpress-db:places:301")?.summary?.conflictReason, "LAST_IMPORTED_AT_UNKNOWN");
  assert.equal(byKey.get("wordpress-db:routes:701"), routeItem);
}

async function testSampledPlaceMediaPolicy() {
  const previousAppEnv = process.env.APP_ENV;
  process.env.APP_ENV = "LOCAL";
  try {
    const processed = await applyStateAwarePlacePreview({
      plan: planFixture([
        planItemFixture({ sourceRecordKey: "wordpress-db:places:5389", action: "CREATE", summary: { mediaRefCount: 2 } }),
        planItemFixture({ sourceRecordKey: "wordpress-db:places:895", action: "CREATE", summary: { mediaRefCount: 11 } }),
        planItemFixture({ sourceRecordKey: "wordpress-db:places:43023", action: "CREATE", summary: { mediaRefCount: 13 } }),
        planItemFixture({ sourceRecordKey: "wordpress-db:places:301", action: "CREATE", summary: { mediaRefCount: 1 } }),
      ]),
      sourceId: "source-1",
      prisma: {
        migrationLineage: { findFirst: async () => null },
        place: { findUnique: async () => null },
      },
    });

    const byKey = new Map(processed.items.map((item) => [item.sourceRecordKey, item]));
    assert.equal(byKey.get("wordpress-db:places:5389")?.summary?.mediaPolicy, "FULL");
    assert.equal(byKey.get("wordpress-db:places:5389")?.summary?.plannedMediaAction, "FULL_IMPORT");
    assert.equal(byKey.get("wordpress-db:places:895")?.summary?.mediaPolicy, "FULL");
    assert.equal(byKey.get("wordpress-db:places:43023")?.summary?.mediaPolicy, "FULL");
    assert.equal(byKey.get("wordpress-db:places:301")?.summary?.mediaPolicy, "METADATA");
    assert.equal(byKey.get("wordpress-db:places:301")?.summary?.plannedMediaAction, "METADATA_ONLY");
  } finally {
    if (previousAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousAppEnv;
    }
  }
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
  await testLedgerSameHashPlansSkipUnchanged();
  await testLedgerChangedHashPlansUpdateAndSafePreviewKeepsUpdate();
  await testEntityFilterAppliesThroughAdapterAndEngine();
  await testStatsPresentAndUsedByReport();
  await testHumanReportContent();
  await testHumanReportEntityFilterNarrowsBreakdown();
  testHumanReportShowsMaterializedSessionCountForEvents();
  testJsonReportIncludesMaterializedSessionFields();
  testHumanReportSingleDateEventNeverShowsAsARange();
  testJsonReportSingleDateEventHasZeroRawRangeCount();
  await testJsonReportExcludesRawContent();
  await testPreviewConflictDoesNotRequireWriteDelegatesAndSerializesSafeFields();
  await testPreviewTargetRowMissingConflict();
  await testPreviewTargetModifiedAfterImportConflict();
  await testAllEntityPreviewEnablesStateAwarePlaceDependency();
  await testMixedPlanPlaceSkipUnchangedAndNonPlaceUnchanged();
  await testMixedPlanSafePlaceUpdateUsesClassifierAndNonPlaceUnchanged();
  await testMixedPlanUnsafePlaceUpdateBecomesConflictAndNonPlaceUnchanged();
  await testSampledPlaceMediaPolicy();
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
