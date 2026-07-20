import assert from "node:assert/strict";

import {
  CANONICAL_SOURCE_HASH_VERSION,
  hashArticleBundle,
  hashEventBundle,
  hashPlaceBundle,
  hashRouteBundle,
} from "./canonicalSourceHash";
import type {
  WordPressArticleBundle,
  WordPressEventBundle,
  WordPressPlaceBundle,
  WordPressPlaceIndexRow,
  WordPressPostMetaByKey,
  WordPressPostRow,
  WordPressRouteBundle,
  WordPressTermRow,
} from "./types";

function post(overrides: Partial<WordPressPostRow> = {}): WordPressPostRow {
  return {
    ID: 1,
    post_author: 1,
    post_date: "2026-01-01 00:00:00",
    post_content: "<p>content</p>",
    post_title: "Title",
    post_excerpt: "Excerpt",
    post_status: "publish",
    post_name: "slug",
    post_modified: "2026-01-02 00:00:00",
    post_parent: 0,
    guid: "https://example.com/?p=1",
    post_type: "post",
    post_mime_type: "",
    ...overrides,
  };
}

function term(overrides: Partial<WordPressTermRow> = {}): WordPressTermRow {
  return { post_id: 1, term_id: 1, name: "Category", slug: "category", taxonomy: "category", ...overrides };
}

function eventBundle(overrides: {
  post?: Partial<WordPressPostRow>;
  postMeta?: WordPressPostMetaByKey;
  terms?: readonly WordPressTermRow[];
} = {}): WordPressEventBundle {
  return {
    post: post({ post_type: "events", ...overrides.post }),
    postMeta: overrides.postMeta ?? { event_date: ["2026-08-15 10:00:00"] },
    terms: overrides.terms ?? [],
  };
}

function placeBundle(overrides: {
  post?: Partial<WordPressPostRow>;
  postMeta?: WordPressPostMetaByKey;
  terms?: readonly WordPressTermRow[];
  placeIndex?: WordPressPlaceIndexRow | null;
} = {}): WordPressPlaceBundle {
  return {
    post: post({ post_type: "places", ...overrides.post }),
    postMeta: overrides.postMeta ?? { cover: ["100"] },
    terms: overrides.terms ?? [],
    placeIndex: overrides.placeIndex ?? null,
  };
}

function articleBundle(overrides: {
  post?: Partial<WordPressPostRow>;
  postMeta?: WordPressPostMetaByKey;
  terms?: readonly WordPressTermRow[];
} = {}): WordPressArticleBundle {
  return {
    post: post({ post_type: "post", ...overrides.post }),
    postMeta: overrides.postMeta ?? {},
    terms: overrides.terms ?? [],
  };
}

function routeBundle(overrides: {
  post?: Partial<WordPressPostRow>;
  postMeta?: WordPressPostMetaByKey;
  terms?: readonly WordPressTermRow[];
} = {}): WordPressRouteBundle {
  return {
    post: post({ post_type: "routes", ...overrides.post }),
    postMeta: overrides.postMeta ?? { "title-location-0": ["Stop 1"] },
    terms: overrides.terms ?? [],
  };
}

// ---------------------------------------------------------------------------
// Volatility — none of these plugin/cron/housekeeping meta keys (or
// post_modified) may change the hash, for any of the 4 entities.
// ---------------------------------------------------------------------------

function testEventVolatileMetaNeverChangesHash() {
  const base = hashEventBundle(eventBundle());
  const volatileKeys: WordPressPostMetaByKey[] = [
    { event_date: ["2026-08-15 10:00:00"], rank_math_internal_links_processed: ["1"] },
    { event_date: ["2026-08-15 10:00:00"], "voxel:view_counts": ["999"] },
    { event_date: ["2026-08-15 10:00:00"], "voxel:view_chart_cache": ["[1,2,3]"] },
    { event_date: ["2026-08-15 10:00:00"], _edit_lock: ["1234567890:1"] },
    { event_date: ["2026-08-15 10:00:00"], _edit_last: ["1"] },
    { event_date: ["2026-08-15 10:00:00"], some_never_seen_plugin_key_xyz: ["anything"] },
  ];
  for (const postMeta of volatileKeys) {
    assert.equal(hashEventBundle(eventBundle({ postMeta })), base, `postMeta=${JSON.stringify(postMeta)} must not change the hash`);
  }
}

function testPostModifiedNeverChangesHashForAnyEntity() {
  assert.equal(
    hashEventBundle(eventBundle({ post: { post_modified: "2099-12-31 23:59:59" } })),
    hashEventBundle(eventBundle()),
  );
  assert.equal(
    hashPlaceBundle(placeBundle({ post: { post_modified: "2099-12-31 23:59:59" } })),
    hashPlaceBundle(placeBundle()),
  );
  assert.equal(
    hashArticleBundle(articleBundle({ post: { post_modified: "2099-12-31 23:59:59" } })),
    hashArticleBundle(articleBundle()),
  );
  assert.equal(
    hashRouteBundle(routeBundle({ post: { post_modified: "2099-12-31 23:59:59" } })),
    hashRouteBundle(routeBundle()),
  );
}

function testPlaceVolatileMetaNeverChangesHash() {
  const base = hashPlaceBundle(placeBundle());
  assert.equal(
    hashPlaceBundle(placeBundle({ postMeta: { cover: ["100"], _edit_lock: ["999:2"] } })),
    base,
  );
  assert.equal(
    hashPlaceBundle(placeBundle({ postMeta: { cover: ["100"], unknown_plugin_meta: ["x"] } })),
    base,
  );
}

// ---------------------------------------------------------------------------
// Place coordinates come from `placeIndex.lat`/`.lng` (wp_voxel_index_places),
// not from any postmeta key — normalizePlace() reads them directly into
// NormalizedPlaceCandidate.coordinates. `priority` is unread and must stay
// hash-insignificant.
// ---------------------------------------------------------------------------

function testPlaceCoordinatesFromIndexChangeHash() {
  const withIndex = (lat: number, lng: number, priority = 1) =>
    placeBundle({ placeIndex: { post_id: 1, post_status: "publish", priority, lat, lng } });

  const base = hashPlaceBundle(withIndex(53.9, 27.5667));
  assert.notEqual(hashPlaceBundle(withIndex(54.0, 27.5667)), base, "changed lat must change the hash");
  assert.notEqual(hashPlaceBundle(withIndex(53.9, 27.6)), base, "changed lng must change the hash");
}

function testPlaceCoordinatesNullToPresentChangesHash() {
  const withoutIndex = hashPlaceBundle(placeBundle({ placeIndex: null }));
  const withIndex = hashPlaceBundle(
    placeBundle({ placeIndex: { post_id: 1, post_status: "publish", priority: 1, lat: 53.9, lng: 27.5667 } }),
  );
  assert.notEqual(withoutIndex, withIndex, "gaining real coordinates (null -> present) must change the hash");
}

function testPlacePriorityDoesNotChangeHash() {
  const a = hashPlaceBundle(
    placeBundle({ placeIndex: { post_id: 1, post_status: "publish", priority: 1, lat: 53.9, lng: 27.5667 } }),
  );
  const b = hashPlaceBundle(
    placeBundle({ placeIndex: { post_id: 1, post_status: "publish", priority: 99, lat: 53.9, lng: 27.5667 } }),
  );
  assert.equal(a, b, "priority is not read by normalizePlace() — must not affect the hash");
}

function testArticleVolatileMetaNeverChangesHash() {
  const base = hashArticleBundle(articleBundle());
  assert.equal(
    hashArticleBundle(articleBundle({ postMeta: { _edit_lock: ["1:1"] } })),
    base,
  );
  assert.equal(
    hashArticleBundle(articleBundle({ postMeta: { rank_math_internal_links_processed: ["1"] } })),
    base,
  );
}

function testRouteVolatileMetaNeverChangesHash() {
  const base = hashRouteBundle(routeBundle());
  assert.equal(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Stop 1"], "route-duration": ["3600"] } })),
    base,
    "route-duration is deliberately never read by normalizeRoute.ts — must never affect the hash",
  );
  assert.equal(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Stop 1"], "route-budget": ["cheap"] } })),
    base,
  );
  assert.equal(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Stop 1"], "reels-route": ["1"] } })),
    base,
  );
}

// ---------------------------------------------------------------------------
// Domain sensitivity — changing a real domain field must change the hash.
// ---------------------------------------------------------------------------

function testEventDomainFieldsChangeHash() {
  const base = hashEventBundle(eventBundle());
  assert.notEqual(hashEventBundle(eventBundle({ post: { post_title: "Different title" } })), base);
  assert.notEqual(hashEventBundle(eventBundle({ post: { post_content: "<p>different</p>" } })), base);
  assert.notEqual(hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-09-01 10:00:00"] } })), base, "date change");
  assert.notEqual(
    hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], "event-cost": ["10 BYN"] } })),
    base,
    "price",
  );
  assert.notEqual(
    hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], location: ['{"address":"x"}'] } })),
    base,
    "location/address/coordinates",
  );
  assert.notEqual(
    hashEventBundle(eventBundle({ terms: [term({ taxonomy: "events-category", slug: "concerts" })] })),
    base,
    "category/terms",
  );
  assert.notEqual(
    hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], _thumbnail_id: ["777"] } })),
    base,
    "featured attachment",
  );
  assert.notEqual(
    hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], gallery: ["1,2,3"] } })),
    base,
    "gallery attachment ids",
  );
}

function testEventGalleryOrderChangesHash() {
  const a = hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], gallery: ["1,2,3"] } }));
  const b = hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], gallery: ["3,2,1"] } }));
  assert.notEqual(a, b, "gallery order feeds ActivityImage.sortOrder — must be hash-significant");
}

function testEventDateRangeEndChangesHash() {
  const withoutEnd = hashEventBundle(
    eventBundle({ postMeta: { event_date: [JSON.stringify({ start: "2026-08-15", end: "2026-08-15" })] } }),
  );
  const withEnd = hashEventBundle(
    eventBundle({ postMeta: { event_date: [JSON.stringify({ start: "2026-08-15", end: "2026-08-20" })] } }),
  );
  assert.notEqual(withoutEnd, withEnd, "a changed range dateEnd must change the hash");
}

function testEventStatusChangesHash() {
  assert.notEqual(
    hashEventBundle(eventBundle({ post: { post_status: "draft" } })),
    hashEventBundle(eventBundle({ post: { post_status: "publish" } })),
  );
}

function testPlaceDomainFieldsChangeHash() {
  const base = hashPlaceBundle(placeBundle());
  assert.notEqual(hashPlaceBundle(placeBundle({ post: { post_title: "New title" } })), base);
  assert.notEqual(
    hashPlaceBundle(placeBundle({ postMeta: { cover: ["100"], location: ['{"address":"Minsk"}'] } })),
    base,
    "address evidence (raw location postmeta) — not the real Place coordinates, which come from placeIndex, see testPlaceCoordinatesFromIndexChangeHash",
  );
  assert.notEqual(
    hashPlaceBundle(placeBundle({ postMeta: { cover: ["100"], phone: ["+375291234567"] } })),
    base,
    "phone",
  );
  assert.notEqual(
    hashPlaceBundle(placeBundle({ postMeta: { cover: ["100"], work_hours: ['[{"days":[1],"status":"hours"}]'] } })),
    base,
    "opening hours",
  );
  assert.notEqual(
    hashPlaceBundle(placeBundle({ terms: [term({ taxonomy: "place-category", slug: "cafe" })] })),
    base,
    "category/terms",
  );
  assert.notEqual(
    hashPlaceBundle(placeBundle({ postMeta: { cover: ["100"], gallery: ["1,2,3"] } })),
    base,
    "gallery media",
  );
  assert.notEqual(
    hashPlaceBundle(placeBundle({ postMeta: { cover: ["999"] } })),
    base,
    "featured media",
  );
}

function testArticleDomainFieldsChangeHash() {
  const base = hashArticleBundle(articleBundle());
  assert.notEqual(hashArticleBundle(articleBundle({ post: { post_title: "New title" } })), base);
  assert.notEqual(hashArticleBundle(articleBundle({ post: { post_name: "new-slug" } })), base, "slug");
  assert.notEqual(hashArticleBundle(articleBundle({ post: { post_content: "<p>new</p>" } })), base, "content");
  assert.notEqual(hashArticleBundle(articleBundle({ post: { post_excerpt: "new excerpt" } })), base, "excerpt");
  assert.notEqual(
    hashArticleBundle(articleBundle({ terms: [term({ taxonomy: "category", slug: "news" })] })),
    base,
    "category",
  );
  assert.notEqual(
    hashArticleBundle(articleBundle({ postMeta: { _thumbnail_id: ["555"] } })),
    base,
    "featured media",
  );
}

// ---------------------------------------------------------------------------
// Article content flags — normalizeArticle() only checks *presence* of
// _elementor_data/_elementor_template_type/wp-story-image/
// wp-story-cycle-image (hasMeta()), never their content, to compute
// hasElementorContent/hasWebStoryContent (ARTICLE_ELEMENTOR_CONTENT/
// ARTICLE_WEB_STORY warnings). The hash must track that exact boolean.
// ---------------------------------------------------------------------------

function testArticleElementorDataPresenceChangesHash() {
  const absent = hashArticleBundle(articleBundle());
  const present = hashArticleBundle(articleBundle({ postMeta: { _elementor_data: ['{"a":1}'] } }));
  assert.notEqual(absent, present, "absent -> _elementor_data present must change the hash");
}

function testArticleElementorTemplateTypePresenceChangesHash() {
  const absent = hashArticleBundle(articleBundle());
  const present = hashArticleBundle(articleBundle({ postMeta: { _elementor_template_type: ["wp-post"] } }));
  assert.notEqual(absent, present, "absent -> _elementor_template_type present must change the hash");
}

function testArticleElementorPayloadChurnDoesNotChangeHash() {
  const first = hashArticleBundle(articleBundle({ postMeta: { _elementor_data: ['{"a":1,"b":[1,2,3]}'] } }));
  const second = hashArticleBundle(articleBundle({ postMeta: { _elementor_data: ['{"totally":"different","nested":{"x":99}}'] } }));
  assert.equal(first, second, "two different non-empty Elementor payloads must hash the same — only presence is domain-significant");
}

function testArticleWebStoryImagePresenceChangesHash() {
  const absent = hashArticleBundle(articleBundle());
  const present = hashArticleBundle(articleBundle({ postMeta: { "wp-story-image": ["123"] } }));
  assert.notEqual(absent, present, "absent -> wp-story-image present must change the hash");
}

function testArticleWebStoryCycleImagePresenceChangesHash() {
  const absent = hashArticleBundle(articleBundle());
  const present = hashArticleBundle(articleBundle({ postMeta: { "wp-story-cycle-image": ["456"] } }));
  assert.notEqual(absent, present, "absent -> wp-story-cycle-image present must change the hash");
}

function testArticleWebStoryValueChurnDoesNotChangeHash() {
  const first = hashArticleBundle(articleBundle({ postMeta: { "wp-story-image": ["111"] } }));
  const second = hashArticleBundle(articleBundle({ postMeta: { "wp-story-image": ["222"] } }));
  assert.equal(first, second, "two different non-empty Web Story values must hash the same — only presence is domain-significant");
}

function testRouteDomainFieldsChangeHash() {
  const base = hashRouteBundle(routeBundle());
  assert.notEqual(hashRouteBundle(routeBundle({ post: { post_title: "New route title" } })), base);
  assert.notEqual(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Stop 1"], "title-location-1": ["Stop 2"] } })),
    base,
    "adding a stop",
  );
  assert.notEqual(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Different stop title"] } })),
    base,
    "stop title",
  );
  assert.notEqual(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Stop 1"], "description-location-0": ["desc"] } })),
    base,
    "stop description",
  );
  assert.notEqual(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Stop 1"], "images-location-0": ["1,2"] } })),
    base,
    "stop images",
  );
  assert.notEqual(
    hashRouteBundle(routeBundle({ postMeta: { "title-location-0": ["Stop 1"], _thumbnail_id: ["1"] } })),
    base,
    "featured media",
  );
}

function testRouteStopOrderChangesHash() {
  const forward = hashRouteBundle(
    routeBundle({ postMeta: { "title-location-0": ["A"], "title-location-1": ["B"] } }),
  );
  const swapped = hashRouteBundle(
    routeBundle({ postMeta: { "title-location-0": ["B"], "title-location-1": ["A"] } }),
  );
  assert.notEqual(forward, swapped, "swapping which stop index holds which title must change the hash");
}

function testRouteIgnoredPostFieldsDoNotChangeHash() {
  const base = hashRouteBundle(routeBundle());
  assert.equal(
    hashRouteBundle(routeBundle({ post: { post_content: "<p>completely different content</p>" } })),
    base,
    "normalizeRoute() has no route-level description field at all — post_content must not affect the hash",
  );
  assert.equal(
    hashRouteBundle(routeBundle({ post: { post_excerpt: "completely different excerpt" } })),
    base,
    "post_excerpt is equally unread by normalizeRoute()",
  );
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

function testUnorderedMetaRowPermutationDoesNotChangeHash() {
  const a = hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], "event-cost": ["10 BYN"], "event-place-name": ["Park"] } }));
  const b = hashEventBundle(eventBundle({ postMeta: { "event-place-name": ["Park"], event_date: ["2026-08-15 10:00:00"], "event-cost": ["10 BYN"] } }));
  assert.equal(a, b, "postMeta key insertion order must not matter");
}

function testUnorderedTermPermutationDoesNotChangeHash() {
  const t1 = term({ taxonomy: "events-category", slug: "concerts", name: "Concerts" });
  const t2 = term({ taxonomy: "age-events", slug: "12", name: "12+" });
  const a = hashEventBundle(eventBundle({ terms: [t1, t2] }));
  const b = hashEventBundle(eventBundle({ terms: [t2, t1] }));
  assert.equal(a, b, "taxonomy term row order carries no domain meaning — must canonicalize");
}

function testSameCanonicalInputAlwaysProducesSameHash() {
  const bundle = eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], gallery: ["1,2,3"] } });
  assert.equal(hashEventBundle(bundle), hashEventBundle(bundle));
  assert.equal(hashEventBundle(bundle), hashEventBundle(eventBundle({ postMeta: { event_date: ["2026-08-15 10:00:00"], gallery: ["1,2,3"] } })));
}

// ---------------------------------------------------------------------------
// Version marker
// ---------------------------------------------------------------------------

function testHashIsPrefixedWithVersionAndNeverCollidesWithV1Shape() {
  const hash = hashEventBundle(eventBundle());
  assert.ok(hash.startsWith(`${CANONICAL_SOURCE_HASH_VERSION}:`), `hash must start with "${CANONICAL_SOURCE_HASH_VERSION}:"`);
  const digestPart = hash.slice(CANONICAL_SOURCE_HASH_VERSION.length + 1);
  assert.match(digestPart, /^[0-9a-f]{64}$/, "digest part must still be a plain sha256 hex string");
  // A v1 (unversioned) hash was always exactly 64 hex chars with no prefix —
  // structurally impossible to collide with a versioned string.
  assert.notEqual(hash.length, 64);
}

function testAllFourEntitiesUseTheSameVersion() {
  assert.ok(hashEventBundle(eventBundle()).startsWith(`${CANONICAL_SOURCE_HASH_VERSION}:`));
  assert.ok(hashPlaceBundle(placeBundle()).startsWith(`${CANONICAL_SOURCE_HASH_VERSION}:`));
  assert.ok(hashArticleBundle(articleBundle()).startsWith(`${CANONICAL_SOURCE_HASH_VERSION}:`));
  assert.ok(hashRouteBundle(routeBundle()).startsWith(`${CANONICAL_SOURCE_HASH_VERSION}:`));
}

function main() {
  testEventVolatileMetaNeverChangesHash();
  testPostModifiedNeverChangesHashForAnyEntity();
  testPlaceVolatileMetaNeverChangesHash();
  testPlaceCoordinatesFromIndexChangeHash();
  testPlaceCoordinatesNullToPresentChangesHash();
  testPlacePriorityDoesNotChangeHash();
  testArticleVolatileMetaNeverChangesHash();
  testRouteVolatileMetaNeverChangesHash();

  testEventDomainFieldsChangeHash();
  testEventGalleryOrderChangesHash();
  testEventDateRangeEndChangesHash();
  testEventStatusChangesHash();
  testPlaceDomainFieldsChangeHash();
  testArticleDomainFieldsChangeHash();
  testArticleElementorDataPresenceChangesHash();
  testArticleElementorTemplateTypePresenceChangesHash();
  testArticleElementorPayloadChurnDoesNotChangeHash();
  testArticleWebStoryImagePresenceChangesHash();
  testArticleWebStoryCycleImagePresenceChangesHash();
  testArticleWebStoryValueChurnDoesNotChangeHash();
  testRouteDomainFieldsChangeHash();
  testRouteStopOrderChangesHash();
  testRouteIgnoredPostFieldsDoNotChangeHash();

  testUnorderedMetaRowPermutationDoesNotChangeHash();
  testUnorderedTermPermutationDoesNotChangeHash();
  testSameCanonicalInputAlwaysProducesSameHash();

  testHashIsPrefixedWithVersionAndNeverCollidesWithV1Shape();
  testAllFourEntitiesUseTheSameVersion();

  console.log("canonicalSourceHash tests: OK");
}

main();
