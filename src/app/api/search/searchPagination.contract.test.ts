import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("full search uses bounded batches without widening autocomplete", () => {
  const source = readFileSync("src/app/api/search/route.ts", "utf8");
  assert.match(source, /searchParams\.get\("mode"\) === "full"/);
  assert.match(source, /const pageSize = 24/);
  assert.match(source, /const batchSize = 200/);
  assert.match(source, /take: batchSize/);
  assert.match(source, /cursor: \{ id: cursor \}/);
  assert.match(source, /visibleCount >= offset/);
  assert.match(source, /!full && docs.length >= target/);

  assert.match(source, /NOT: literalTextWhere/);
  assert.match(source, /full \? \{ results, page, pageSize, total, totalPages \} : \{ results \}/);
  assert.match(source, /Number\.isFinite\(rawLimit\)/);
  assert.doesNotMatch(source, /selectedPersonaIds|familyMemberId/);
});

test("full search uses current search card component and both entry points", () => {
  const page = readFileSync("src/app/(public)/[city]/search/page.tsx", "utf8");
  const desktop = readFileSync("src/components/search/SearchOverlay.tsx", "utf8");
  const mobile = readFileSync("src/components/mobile/MobileSearch.tsx", "utf8");
  assert.match(page, /SearchResultItem/);
  assert.match(page, /mode: "full"/);
  assert.match(page, /data\.totalPages/);
  assert.match(desktop, /Показать все результаты/);
  assert.match(mobile, /Показать все результаты/);
});
