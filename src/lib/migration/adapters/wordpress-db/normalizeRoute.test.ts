import assert from "node:assert/strict";

import { normalizeRoute, type NormalizedRouteCandidate } from "./normalizeRoute";
import type { WordPressPostRow, WordPressRouteBundle, WordPressTermRow } from "./types";

function payloadOf(record: ReturnType<typeof normalizeRoute>): NormalizedRouteCandidate {
  return record.normalizedPayload as NormalizedRouteCandidate;
}

const basePost: WordPressPostRow = {
  ID: 17822,
  post_author: 5,
  post_date: "2026-03-20 00:00:00",
  post_content: "<p>Route intro</p>",
  post_title: "Маршрут по Дроздам",
  post_excerpt: "",
  post_status: "publish",
  post_name: "marshrut-po-drozdam",
  post_modified: "2026-03-21 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=17822",
  post_type: "routes",
  post_mime_type: "",
};

// Modeled directly on the real, live-inspected shape (2026-07-13) for WP
// post 17822: 1-based `title-location-N`/`description-location-N`/
// `images-location-N` (comma-separated attachment ids), a route-level
// `location` JSON blob, `rank_math_primary_route-budget` always `0`.
function buildBundle(overrides: Partial<WordPressRouteBundle> = {}): WordPressRouteBundle {
  return {
    post: basePost,
    postMeta: {
      "title-location-1": ["Секретный пляж"],
      "description-location-1": ["<p>Начнем с секретного пляжа</p>"],
      "images-location-1": ["17885,17886"],
      "title-location-2": ["Тропа рыбака"],
      "description-location-2": ["<p>По пути валуны и мостики</p>"],
      "images-location-2": ["17878,17874"],
      location: ['{"address":"53.94599, 27.47237","map_picker":true,"latitude":53.94599,"longitude":27.47237}'],
      _thumbnail_id: ["17884"],
      rank_math_title: ["SEO Title"],
      rank_math_focus_keyword: ["маршрут по дроздам"],
      "rank_math_primary_route-budget": ["0"],
      "rank_math_primary_route-duration": ["0"],
      "route-duration": ["ignored-on-purpose"],
      "reels-route": ["ignored-on-purpose"],
    },
    terms: [],
    ...overrides,
  };
}

function testFullRoute() {
  const record = normalizeRoute(buildBundle());

  assert.equal(record.sourceRecordKey, "wordpress-db:routes:17822");
  assert.equal(record.sourceEntityType, "wordpress-db:routes");
  assert.equal(record.targetTypeHint, "ROUTE");

  const payload = payloadOf(record);
  assert.equal(payload.title, "Маршрут по Дроздам");
  assert.equal(payload.slug, "marshrut-po-drozdam");
  assert.equal(payload.status, "publish");

  assert.deepEqual(
    payload.stops.map((s) => s.index),
    [1, 2],
  );
  assert.equal(payload.stops[0].title, "Секретный пляж");
  assert.equal(payload.stops[0].description, "<p>Начнем с секретного пляжа</p>");
  assert.deepEqual(payload.stops[0].imageAttachmentIds, [17885, 17886]);
  assert.equal(payload.stops[0].placeId, null);

  assert.deepEqual(payload.location, {
    address: "53.94599, 27.47237",
    latitude: 53.94599,
    longitude: 27.47237,
  });
  assert.ok(payload.locationRaw);

  assert.equal(payload.media.featuredAttachmentId, 17884);
  assert.deepEqual(record.mediaRefs, ["17884", "17885", "17886", "17878", "17874"]);

  // route-duration/reels-route/route-budget are consciously dropped, never
  // lifted into the typed payload — but still present in the rawMeta
  // passthrough (route-budget has no dedicated meta key of its own; it's a
  // taxonomy, so it's absent from rawMeta here and only ever visible via
  // sourceTerms, see testBudgetTermNeverResolvedOnlyPassedThrough).
  assert.ok(!("budgetLevel" in payload));
  assert.ok(!("budgetTermRaw" in payload));
  assert.ok(payload.rawMeta["route-duration"]);
  assert.ok(payload.rawMeta["reels-route"]);
  assert.ok(!record.warnings?.some((w) => w.code.startsWith("ROUTE_BUDGET")));
}

function testNoStopsWarns() {
  const record = normalizeRoute(buildBundle({ postMeta: { location: ['{"address":"x"}'] } }));
  const payload = payloadOf(record);
  assert.deepEqual(payload.stops, []);
  assert.ok(record.warnings?.some((w) => w.code === "ROUTE_NO_STOPS"));
}

function testUnsuffixedDuplicateStopKeyExcluded() {
  // Confirmed real-data edge case (WP post 29290, live 2026-07-13): a bare
  // `title-location` key duplicating an already-numbered stop's content.
  const record = normalizeRoute(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        "title-location": ["Дубликат стопа 2"],
        "images-location": ["99999"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.deepEqual(
    payload.stops.map((s) => s.index),
    [1, 2],
  );
  assert.ok(record.warnings?.some((w) => w.code === "ROUTE_META_KEY_UNPARSEABLE_INDEX"));
}

function testInvalidImageIdsWarnAndAreExcluded() {
  const record = normalizeRoute(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        "images-location-1": ["17885,not-a-number,17886"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.deepEqual(payload.stops[0].imageAttachmentIds, [17885, 17886]);
  const warning = record.warnings?.find((w) => w.code === "ROUTE_STOP_MEDIA_SOURCE_INVALID");
  assert.ok(warning);
  assert.equal(warning?.details?.value, "not-a-number");
}

function testMalformedLocationJsonKeptRawOnly() {
  const record = normalizeRoute(
    buildBundle({
      postMeta: { ...buildBundle().postMeta, location: ["not json"] },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.location, null);
  assert.equal(payload.locationRaw, "not json");
  assert.ok(record.warnings?.some((w) => w.code === "ROUTE_LOCATION_UNPARSEABLE"));
}

function testBudgetTermNeverResolvedOnlyPassedThrough() {
  // Product decision (2026-07-13): route-budget is never statically mapped
  // to BudgetLevel at all — Route.budgetLevel is derived later from
  // per-stop prices during manual review. Even with a real route-budget
  // term attached (and even if there were several), normalizeRoute() must
  // not attempt to resolve or interpret it — only pass it through like any
  // other taxonomy term.
  const terms: WordPressTermRow[] = [
    { post_id: 17822, term_id: 900, name: "Бюджетно", slug: "budget-low", taxonomy: "route-budget" },
    { post_id: 17822, term_id: 901, name: "Дорого", slug: "budget-high", taxonomy: "route-budget" },
  ];
  const record = normalizeRoute(buildBundle({ terms }));
  const payload = payloadOf(record);

  assert.ok(!("budgetLevel" in payload));
  assert.ok(!("budgetTermRaw" in payload));
  assert.ok(!record.warnings?.some((w) => w.code.startsWith("ROUTE_BUDGET")));
  assert.deepEqual(payload.sourceTerms, [
    { termId: 900, taxonomy: "route-budget", name: "Бюджетно", slug: "budget-low" },
    { termId: 901, taxonomy: "route-budget", name: "Дорого", slug: "budget-high" },
  ]);
  assert.deepEqual(record.relationRefs, [
    "term:route-budget:budget-low",
    "term:route-budget:budget-high",
  ]);
}

function testEmptyOrBrokenMetaDoesNotThrow() {
  const record = normalizeRoute(buildBundle({ postMeta: {}, terms: [] }));
  const payload = payloadOf(record);
  assert.deepEqual(payload.stops, []);
  assert.equal(payload.location, null);
  assert.equal(payload.locationRaw, null);
  assert.equal(payload.media.featuredAttachmentId, null);
  assert.deepEqual(payload.sourceTerms, []);
  assert.deepEqual(payload.rawMeta, {});
  assert.deepEqual(record.mediaRefs, []);
  assert.deepEqual(record.relationRefs, []);
}

function main() {
  testFullRoute();
  testNoStopsWarns();
  testUnsuffixedDuplicateStopKeyExcluded();
  testInvalidImageIdsWarnAndAreExcluded();
  testMalformedLocationJsonKeptRawOnly();
  testBudgetTermNeverResolvedOnlyPassedThrough();
  testEmptyOrBrokenMetaDoesNotThrow();
}

main();
console.log("normalizeRoute tests: OK");
