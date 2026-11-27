/**
 * Regression test for word-order-sensitive search matching + citySlug telemetry.
 *
 * `/api/search` used a single `searchText: { contains: q }` substring match,
 * so a multi-word query only matched when the words appeared in that exact
 * order inside the indexed blob — e.g. "балет три поросенка" (natural
 * adjective-first phrasing) returned zero results even though the document
 * title is "балет «Три поросенка»" and both "балет" and "три поросенка"
 * individually matched. Confirmed reproducible on real DEV data (dev.mamago.by)
 * during the Task 2 (Search Ranking) DEV→PROD audit. Fix: split the query
 * into whitespace tokens and require every token to match independently
 * (AND), so word order no longer matters. Single-token queries keep the
 * exact prior behavior (no regression).
 *
 * Also covers SearchQueryLog city telemetry via citySlug (public contract):
 * valid slug → cityId populated; unknown slug → cityId null; search still 200.
 *
 * Self-generated temporary fixture (created and torn down within this
 * file), per project convention — no committed snapshot or /tmp dependency.
 * Exercises the real exported GET() against the local dev DB.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/app/api/search/route.test.ts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prismaBase as prisma } from "@/lib/prisma";
import { GET } from "./route";
import { findCityBySlug } from "@/server/geo/findCityBySlug";

const FIXTURE_ENTITY_ID = "test-fixture-search-word-order-activity";
const TELEMETRY_QUERY_PREFIX = "__seo_cityslug_telemetry__";

async function withFixtureDocument<T>(fn: () => Promise<T>): Promise<T> {
  const owner = await prisma.user.create({ data: { email: `search-audit-${Date.now()}@example.invalid` } });
  try {
  await prisma.activity.create({ data: {
    id: FIXTURE_ENTITY_ID, ownerUserId: owner.id, title: "Search fixture",
    shortDesc: "Search fixture", ageTags: [], type: "EVENT", scheduleMode: "ALWAYS", status: "PUBLISHED",
  } });
  await prisma.searchDocument.upsert({
    where: { entityType_entityId: { entityType: "activity", entityId: FIXTURE_ENTITY_ID } },
    create: {
      entityType: "activity",
      entityId: FIXTURE_ENTITY_ID,
      title: "С. Кибирова балет «Три поросенка»",
      searchText: "С. Кибирова балет «Три поросенка»\nбалет\nтри поросенка",
      metaLine: "test fixture",
      urlPath: "/minsk/events/test-fixture-search-word-order",
      isPublished: true,
      boost: 1,
    },
    update: {},
  });
    return await fn();
  } finally {
    await prisma.searchDocument.deleteMany({ where: { entityId: FIXTURE_ENTITY_ID } });
    await prisma.activity.deleteMany({ where: { id: FIXTURE_ENTITY_ID } });
    await prisma.user.delete({ where: { id: owner.id } });
  }
}

async function search(q: string, extraParams?: Record<string, string>) {
  const params = new URLSearchParams({ q, ...(extraParams ?? {}) });
  const req = new NextRequest(`http://localhost:3000/api/search?${params}`);
  const res = await GET(req);
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const body = await res.json();
  return body.results as Array<{ id: string }>;
}

async function testOutOfOrderMultiWordQueryMatches() {
  await withFixtureDocument(async () => {
    const forward = await search("три поросенка балет");
    assert.ok(
      forward.some((r) => r.id === FIXTURE_ENTITY_ID),
      "forward-order multi-word query must match",
    );

    const reordered = await search("балет три поросенка");
    assert.ok(
      reordered.some((r) => r.id === FIXTURE_ENTITY_ID),
      "reordered multi-word query must match the same document (word order must not matter)",
    );
  });
}

async function testInvalidLimitFallsBackToDefault() {
  await withFixtureDocument(async () => {
    const results = await search("поросенка", { limit: "invalid" });
    assert.ok(
      results.some((r) => r.id === FIXTURE_ENTITY_ID),
      "invalid limit must not break search",
    );
    assert.ok(results.length <= 8);
  });
}

async function testBoundedSearchPagination() {
  const prefix = `auditbatch${Date.now()}`;
  const owner = await prisma.user.create({
    data: { email: `${prefix}@example.invalid` },
  });

  const fixtures = Array.from({ length: 450 }, (_, i) => ({
    id: `${prefix}-${String(i).padStart(4, "0")}`,
    visible: i % 5 !== 0,
  }));

  try {
    await prisma.activity.createMany({
      data: fixtures.map(f => ({
        id: f.id,
        ownerUserId: owner.id,
        title: prefix,
        shortDesc: prefix,
        ageTags: [],
        type: "EVENT",
        scheduleMode: "ALWAYS",
        status: f.visible ? "PUBLISHED" : "DRAFT",
      })),
    });

    await prisma.searchDocument.createMany({
      data: fixtures.map(f => ({
        entityType: "activity",
        entityId: f.id,
        title: prefix,
        searchText: prefix,
        metaLine: "audit fixture",
        urlPath: `/minsk/events/${f.id}`,
        isPublished: true,
        boost: 1,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      })),
    });

    const expected = fixtures
      .filter(f => f.visible)
      .map(f => f.id)
      .sort();

    const collected: string[] = [];

    for (let page = 1; page <= 16; page++) {
      const started = performance.now();

      const params = new URLSearchParams({
        q: prefix,
        mode: "full",
        page: String(page),
      });

      const response = await GET(new NextRequest(
        `http://localhost:3000/api/search?${params}`
      ));

      assert.equal(response.status, 200);

      const body = await response.json();

      assert.equal(body.total, 360);
      assert.equal(body.totalPages, 15);
      assert.equal(body.page, page);

      const ids = body.results.map(
        (r: { id: string }) => r.id
      );

      assert.deepEqual(
        ids,
        expected.slice((page - 1) * 24, page * 24),
      );

      collected.push(...ids);

      console.log(
        `[AUDIT BATCH] page=${page} results=${ids.length} ` +
        `durationMs=${Math.round(performance.now() - started)}`
      );
    }

    assert.deepEqual(collected, expected);
    assert.equal(new Set(collected).size, 360);

    const autocomplete = await search(prefix, { limit: "20" });

    assert.deepEqual(
      autocomplete.map(r => r.id),
      expected.slice(0, 20),
    );

    console.log("[AUDIT BATCH] PASS: 450 indexed, 360 visible");
  } finally {
    await prisma.searchDocument.deleteMany({
      where: { entityId: { startsWith: prefix } },
    });
    await prisma.activity.deleteMany({
      where: { ownerUserId: owner.id },
    });
    await prisma.user.delete({
      where: { id: owner.id },
    });
  }
}

async function testSingleTokenQueryUnaffected() {
  await withFixtureDocument(async () => {
    const results = await search("поросенка");
    assert.ok(
      results.some((r) => r.id === FIXTURE_ENTITY_ID),
      "single-token substring query must still match",
    );
  });
}

async function testMultiWordQueryRequiresAllTokens() {
  await withFixtureDocument(async () => {
    const results = await search("три поросенка драконы");
    assert.ok(
      !results.some((r) => r.id === FIXTURE_ENTITY_ID),
      "a token absent from the document must exclude it (AND semantics, not OR)",
    );
  });
}

async function testStaleDocumentExcluded() {
  await withFixtureDocument(async () => {
    await prisma.activity.update({ where: { id: FIXTURE_ENTITY_ID }, data: { status: "DRAFT" } });
    for (const mode of ["full", "autocomplete"]) {
      const params = new URLSearchParams({ q: "поросенка", mode });
      const res = await GET(new NextRequest(`http://localhost:3000/api/search?${params}`));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.results));

      if (mode === "full") {
        assert.equal(typeof body.total, "number");
        assert.equal(typeof body.totalPages, "number");
      }
      assert.ok(!body.results.some((r: { id: string }) => r.id === FIXTURE_ENTITY_ID));
    }
  });
}

async function testConcurrentVisibilityTransition() {
  await withFixtureDocument(async () => {
    const before = await search("поросенка");
    assert.ok(before.some(r => r.id === FIXTURE_ENTITY_ID));

    const concurrentReads = Promise.all(
      Array.from({ length: 8 }, () =>
        search("поросенка", { mode: "full" })
      )
    );

    await prisma.activity.update({
      where: { id: FIXTURE_ENTITY_ID },
      data: { status: "DRAFT" },
    });

    await concurrentReads;

    const stale = await prisma.searchDocument.findUnique({
      where: {
        entityType_entityId: {
          entityType: "activity",
          entityId: FIXTURE_ENTITY_ID,
        },
      },
    });

    assert.equal(stale?.isPublished, true);

    const after = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        search("поросенка", {
          mode: i % 2 === 0 ? "full" : "autocomplete",
        })
      )
    );

    for (const results of after) {
      assert.ok(Array.isArray(results));
      assert.ok(
        !results.some(r => r.id === FIXTURE_ENTITY_ID),
        "Committed unpublication must hide stale search documents",
      );
    }

    console.log("[AUDIT CONCURRENCY] PASS");
  });
}

async function testOversizedQueryDoesNotCrash() {
  const longQuery = "а".repeat(5000);
  const results = await search(longQuery);
  assert.ok(Array.isArray(results), "oversized query must be handled gracefully, not throw");
}

async function testManyTokenQueryDoesNotCrash() {
  const manyTokens = Array.from({ length: 50 }, (_, i) => `слово${i}`).join(" ");
  const results = await search(manyTokens);
  assert.ok(Array.isArray(results), "query with many tokens must be handled gracefully, not throw");
}

async function waitForLog(query: string) {
  const normalized = query.trim().toLowerCase();
  for (let i = 0; i < 20; i += 1) {
    const row = await prisma.searchQueryLog.findFirst({
      where: { query: normalized },
      orderBy: { createdAt: "desc" },
      select: { id: true, cityId: true },
    });
    if (row) return row;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function testValidCitySlugPopulatesSearchQueryLog() {
  const minsk = await findCityBySlug("minsk", {
    onlyRealCities: true,
    select: { id: true },
  });
  assert.ok(minsk?.id, "fixture city minsk must exist");

  const q = `${TELEMETRY_QUERY_PREFIX} valid ${Date.now()}`;
  await search(q, { citySlug: "minsk", limit: "8" });
  const log = await waitForLog(q);
  assert.ok(log, "SearchQueryLog row must be written");
  assert.equal(log.cityId, minsk.id, "valid citySlug must populate cityId");
  await prisma.searchQueryLog.deleteMany({ where: { id: log.id } });
}

async function testUnknownCitySlugLeavesCityIdNull() {
  const q = `${TELEMETRY_QUERY_PREFIX} unknown ${Date.now()}`;
  const results = await search(q, {
    citySlug: "no-such-city-slug-xyz",
    limit: "8",
  });
  assert.ok(Array.isArray(results), "unknown slug must not break search");
  const log = await waitForLog(q);
  assert.ok(log, "SearchQueryLog row must still be written");
  assert.equal(log.cityId, null, "unknown citySlug must log cityId=null");
  await prisma.searchQueryLog.deleteMany({ where: { id: log.id } });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("/api/search route.test.ts: SKIP (DATABASE_URL not set)");
    process.exit(0);
  }
  const country = await prisma.country.findUnique({
    where: { isoCode: "BY" },
    select: { id: true },
  });

  assert.ok(country, "Belarus migration fixture must exist");

  const existingMinsk = await findCityBySlug("minsk", {
    onlyRealCities: true,
    select: { id: true },
  });

  const createdMinsk = existingMinsk ? null : await prisma.city.create({
    data: {
      name: "Минск",
      slug: "minsk",
      countryId: country.id,
      isActive: true,
    },
  });

  try {
  await testOutOfOrderMultiWordQueryMatches();
  await testSingleTokenQueryUnaffected();
  await testInvalidLimitFallsBackToDefault();
  await testBoundedSearchPagination();
  await testMultiWordQueryRequiresAllTokens();
  await testStaleDocumentExcluded();
  await testConcurrentVisibilityTransition();
  await testOversizedQueryDoesNotCrash();
  await testManyTokenQueryDoesNotCrash();
  await testValidCitySlugPopulatesSearchQueryLog();
  await testUnknownCitySlugLeavesCityIdNull();
  } finally {
    if (createdMinsk) {
      await prisma.city.delete({
        where: { id: createdMinsk.id },
      });
    }
  }

  console.log("/api/search word-order + citySlug telemetry tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
