/**
 * Статические проверки парсера abws-performances-event (без сети).
 *
 * Фикстура ниже — best-effort реконструкция формы performance.id=5852465
 * ("Лунтик. Обратная Сторона Луны") по описанию из
 * docs/imports/abws-phase1-spec.md. Не заменяет проверку на реальном ответе
 * API — см. PR description для вывода живого вызова.
 */
import assert from "node:assert/strict";

import {
  dedupeKey,
  filterCategoryTypeIds,
  isSingleVenue,
  mapAbwsPerformanceToRawPayload,
  mapAbwsSession,
  normalizeSessionTagName,
  normalizeSessionTags,
  parseAbwsResponseBody,
  type AbwsPerformanceItem,
} from "./abws-performances-event.parser";

const singleVenueFixture: AbwsPerformanceItem = {
  performance: {
    id: 5852465,
    name: "Лунтик. Обратная Сторона Луны",
    description: "<p>Мультимедийное шоу для всей семьи.</p>",
    minAge: 0,
    duration: 60,
    showFrom: 1_760_000_000,
    showTo: 1_765_000_000,
    // Real shape (confirmed live): keyed by thumbnail size, not a flat URL.
    image: { "240x340": "https://24afisha.by/images/5852465/main-240.jpg", original: "https://24afisha.by/images/5852465/main.jpg" },
    images: [{ "880x550": "https://24afisha.by/images/5852465/1-880.jpg", original: "https://24afisha.by/images/5852465/1.jpg" }],
    minPrice: "25.00",
    maxPrice: "45.00",
    types: [
      { id: 1, name: "Кино" },
      { id: 54, name: "Брестский театр драмы" },
    ],
    urlSaleframe: "https://saleframe.24afisha.by/?pid=5852465",
    deletedAt: null,
  },
  sessions: [
    {
      id: 1743171,
      timeSpending: 1_760_100_000,
      minPrice: 2500,
      maxPrice: 4500,
      urlSaleframe: "https://saleframe.24afisha.by/?sid=1743171",
      isSaleOpen: true,
      deletedAt: null,
      object: { id: 501, name: "Дворец Республики", address: "пр. Независимости, 2", city: { slug: "minsk" } },
      tags: [{ name: "2D" }, { name: "2 D" }],
      type: "default",
      // Real shape (confirmed live): /ru/{citySlug}/events/{category}/{id}?sid=...
      url: "https://24afisha.by/ru/minsk/events/kino/5852465?sid=1743171&distributor_company_id=550",
    },
    {
      id: 1743172,
      timeSpending: 1_760_200_000,
      minPrice: 2500,
      maxPrice: 4500,
      urlSaleframe: "https://saleframe.24afisha.by/?sid=1743172",
      isSaleOpen: false,
      deletedAt: null,
      object: { id: 501, name: "Дворец Республики", address: "пр. Независимости, 2", city: { slug: "minsk" } },
      tags: [{ name: "3D" }],
      type: "default",
      url: "https://24afisha.by/ru/minsk/events/kino/5852465?sid=1743172&distributor_company_id=550",
    },
  ],
};

const multiVenueFixture: AbwsPerformanceItem = {
  performance: { ...singleVenueFixture.performance, id: 999 },
  sessions: [
    { ...singleVenueFixture.sessions[0], object: { id: 501, city: { slug: "minsk" } } },
    { ...singleVenueFixture.sessions[1], id: 1743173, object: { id: 777, city: { slug: "brest" } } },
  ],
};

// ── isSingleVenue ────────────────────────────────────────────────────────
assert.equal(isSingleVenue(singleVenueFixture.sessions), true);
assert.equal(isSingleVenue(multiVenueFixture.sessions), false);
assert.equal(isSingleVenue([]), true, "no sessions counts as single-venue (0 distinct venues)");

// ── dedupeKey ────────────────────────────────────────────────────────────
assert.equal(dedupeKey(singleVenueFixture), "5852465");

// ── category whitelist (§5.1) ────────────────────────────────────────────
{
  const { categoryTypeIds, unrecognizedTypes } = filterCategoryTypeIds(singleVenueFixture.performance.types);
  assert.deepEqual(categoryTypeIds, [1]);
  assert.equal(unrecognizedTypes.length, 1);
  assert.equal(unrecognizedTypes[0].id, 54);
}
assert.deepEqual(filterCategoryTypeIds(null), { categoryTypeIds: [], unrecognizedTypes: [] });

// ── session tag normalization ─────────────────────────────────────────────
assert.equal(normalizeSessionTagName("2 D"), "2d");
assert.equal(normalizeSessionTagName("2D"), "2d");
assert.deepEqual(normalizeSessionTags([{ name: "2 D" }, { name: "2D" }]), ["2d"]);

// ── mapAbwsSession ─────────────────────────────────────────────────────────
{
  const mapped = mapAbwsSession(singleVenueFixture.sessions[0]);
  assert.equal(mapped.externalId, "1743171");
  assert.equal(mapped.startsAt, new Date(1_760_100_000 * 1000).toISOString());
  assert.equal(mapped.priceMinCents, 2500, "session price kept raw, not converted to rubles");
  assert.equal(mapped.priceMaxCents, 4500);
  assert.equal(mapped.isSaleOpen, true);
  assert.equal(mapped.citySlugMismatch, false);
  assert.deepEqual(mapped.tags, ["2d"]);
}

// citySlugMismatch: object says minsk, url says brest (city is path segment
// index 1, after the "ru" locale prefix — confirmed live)
{
  const mismatched = mapAbwsSession({
    ...singleVenueFixture.sessions[0],
    object: { id: 501, city: { slug: "minsk" } },
    url: "https://24afisha.by/ru/brest/events/kino/5852465?sid=1743171&distributor_company_id=550",
  });
  assert.equal(mismatched.citySlugMismatch, true);
}

// A URL sharing the fixture's own city must NOT be flagged (regression check
// for the earlier bug that read the locale segment instead of the city one).
assert.equal(mapAbwsSession(singleVenueFixture.sessions[0]).citySlugMismatch, false);

// ── full performance mapping — price units kept separate (§2.4) ──────────
{
  const rawPayload = mapAbwsPerformanceToRawPayload(singleVenueFixture);
  assert.equal(rawPayload.title, "Лунтик. Обратная Сторона Луны");
  assert.equal(rawPayload.ageMin, 0);
  assert.equal(rawPayload.durationMinutes, 60);
  assert.equal(rawPayload.perfPriceMinRub, 25, "performance price parsed as rubles, not divided by 100");
  assert.equal(rawPayload.perfPriceMaxRub, 45);
  assert.equal(rawPayload.isSingleVenue, true);
  assert.equal(rawPayload.sessions.length, 2);
  assert.equal(rawPayload.sessions[0].priceMinCents, 2500, "session price NOT converted — raw source unit");
  assert.deepEqual(rawPayload.categoryTypeIds, [1]);
  assert.equal(rawPayload.unrecognizedTypes.length, 1);
  assert.equal(rawPayload.llm.category, null, "LLM normalization out of scope for this PR");
  assert.deepEqual(rawPayload.images, [
    "https://24afisha.by/images/5852465/main.jpg",
    "https://24afisha.by/images/5852465/1.jpg",
  ]);
}

{
  const rawPayload = mapAbwsPerformanceToRawPayload(multiVenueFixture);
  assert.equal(rawPayload.isSingleVenue, false, "multi-venue performances are flagged, not filtered out here");
}

// ── response envelope handling ─────────────────────────────────────────────
assert.deepEqual(parseAbwsResponseBody(JSON.stringify([singleVenueFixture])), [singleVenueFixture]);
assert.deepEqual(
  parseAbwsResponseBody(JSON.stringify({ data: [singleVenueFixture] })),
  [singleVenueFixture],
);
assert.throws(() => parseAbwsResponseBody(JSON.stringify({ unexpected: true })), /Unrecognized ABWS response/);
assert.throws(() => parseAbwsResponseBody("not json"), /not valid JSON/);
