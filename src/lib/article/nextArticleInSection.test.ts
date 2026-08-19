import assert from "node:assert/strict";
import {
  buildNextArticleInSectionWhere,
  normalizeExcludeIds,
  MAX_NEXT_ARTICLE_EXCLUDE_IDS,
  NEXT_ARTICLE_ORDER_BY,
} from "./nextArticleInSectionQuery";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";

const now = new Date("2026-06-01T12:00:00.000Z");

{
  const ids = normalizeExcludeIds(
    ["a", "b", "a", "  ", "c"],
    "current",
    4,
  );
  assert.deepEqual(ids, ["current", "a", "b", "c"]);
  assert.ok(ids.length <= 4);
}

{
  const many = Array.from({ length: 100 }, (_, i) => `id-${i}`);
  const ids = normalizeExcludeIds(many, "seed");
  assert.equal(ids[0], "seed");
  assert.equal(ids.length, MAX_NEXT_ARTICLE_EXCLUDE_IDS);
}

{
  const where = buildNextArticleInSectionWhere({
    sectionId: "sec-1",
    cityId: "city-1",
    geoScope: "CITY",
    excludeIds: ["a1", "a2"],
    now,
  });

  assert.equal(where.status, "PUBLISHED");
  assert.equal(where.categoryId, "sec-1");
  assert.equal(where.geoScope, "CITY");
  assert.equal(where.cityId, "city-1");
  assert.deepEqual(where.id, { notIn: ["a1", "a2"] });
  assert.deepEqual(where.publishedAt, { lte: now });
  assert.deepEqual(where.slug, { not: null });
  assert.ok(Array.isArray(where.OR));
  assert.deepEqual(where.OR, [
    { subtitle: null },
    { subtitle: { not: BREAKING_NEWS_SUBTITLE } },
  ]);
}

{
  const national = buildNextArticleInSectionWhere({
    sectionId: "sec-2",
    cityId: null,
    geoScope: "COUNTRY",
    excludeIds: ["x"],
    now,
  });
  assert.equal(national.cityId, null);
  assert.equal(national.geoScope, "COUNTRY");
}

{
  assert.deepEqual(NEXT_ARTICLE_ORDER_BY, [
    { publishedAt: "desc" },
    { id: "desc" },
  ]);
}

console.log("✅ nextArticleInSection.test.ts");
