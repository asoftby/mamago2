/**
 * Regression test for word-order-sensitive search matching.
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
 * Self-generated temporary fixture (created and torn down within this
 * file), per project convention — no committed snapshot or /tmp dependency.
 * Exercises the real exported GET() against the local dev DB.
 *
 * Запуск: set -a; source .env; set +a; npx tsx src/app/api/search/route.test.ts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { GET } from "./route";

const FIXTURE_ENTITY_ID = "test-fixture-search-word-order-activity";

async function withFixtureDocument<T>(fn: () => Promise<T>): Promise<T> {
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
  try {
    return await fn();
  } finally {
    await prisma.searchDocument.deleteMany({ where: { entityId: FIXTURE_ENTITY_ID } });
  }
}

async function search(q: string) {
  const req = new NextRequest(`http://localhost:3000/api/search?q=${encodeURIComponent(q)}`);
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

async function main() {
  await testOutOfOrderMultiWordQueryMatches();
  await testSingleTokenQueryUnaffected();
  await testMultiWordQueryRequiresAllTokens();
  await testOversizedQueryDoesNotCrash();
  await testManyTokenQueryDoesNotCrash();
  console.log("/api/search word-order tests: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
