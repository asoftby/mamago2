/**
 * Run: pnpm exec tsx src/server/territory/listAvailableTerritories.test.ts
 */
import assert from "node:assert/strict";
import { buildAvailableTerritories } from "./listAvailableTerritories";
import {
  countPublicContentForTerritory,
  EMPTY_SECTION_COUNTS,
  totalSectionCounts,
  type TerritoryCountsDb,
  type TerritorySectionCounts,
} from "./territoryContentCounts";
import { defaultTerritorySlugForSection, isTerritoryTypeSupported } from "@/lib/territory/territorySections";
import { parseTerritoryCookie, serializeTerritoryCookie } from "@/lib/territory/territoryCookie";

const r = (id: string, type: "COUNTRY" | "REGION" | "CITY", slug: string, parentId: string | null, priority = 0, vis = true) => ({
  id, type, slug, name: slug, nameIn: null, parentId, priority, isVisibleInCityFilter: vis,
});
const rows = [
  r("c", "COUNTRY", "belarus", null, 100),
  r("rm", "REGION", "minsk", "c", 100),
  r("rg", "REGION", "grodno", "c", 90),
  r("rb", "REGION", "brest", "c", 90),
  r("cm", "CITY", "minsk", "rm"), // centre city of region minsk
  r("ck", "CITY", "kopishche", "rm"),
  r("cg", "CITY", "grodno", "rg"),
  r("cmir", "CITY", "mir", "rg", 0, false), // hidden by admin
  r("cb", "CITY", "brest", "rb"), // no content at all
];
const c = (patch: Partial<TerritorySectionCounts>): TerritorySectionCounts => ({ ...EMPTY_SECTION_COUNTS, ...patch });
const counts = new Map<string, TerritorySectionCounts>([
  ["cm", c({ events: 3, places: 5 })],
  ["ck", c({ articles: 1 })], // a city that only has an article
  ["cg", c({ offers: 2 })],
  ["cmir", c({ places: 9 })],
]);

const list = buildAvailableTerritories(rows, counts, null, 4);
assert.deepEqual(
  list.map((t) => `${t.type}:${t.slug}`),
  ["COUNTRY:belarus", "REGION:minsk", "CITY:kopishche", "REGION:grodno"],
  "country first; centre city folded into its region; hidden and empty entries dropped",
);
assert.equal(list[0].path, "/belarus");
assert.equal(list.find((t) => t.slug === "kopishche")!.counts.articles, 1, "city with only an article is listed");
assert.equal(list.find((t) => t.slug === "minsk")!.counts.events, 3, "region includes its centre city content");
assert.equal(list[0].counts.articles, 5, "country sums regions plus national articles");

// Only an article anywhere is enough; no content at all is not.
assert.ok(buildAvailableTerritories(rows, new Map([["cb", c({ articles: 1 })]]), null).some((t) => t.slug === "brest" && t.type === "REGION"));
assert.ok(!buildAvailableTerritories(rows, new Map(), null).some((t) => t.type !== "COUNTRY"));

const birthday = buildAvailableTerritories(rows, counts, "birthday");
assert.deepEqual(birthday.map((t) => t.supported), [false, true, true, true], "birthday does not support the whole country");
assert.ok(buildAvailableTerritories(rows, counts, "kuda").every((t) => t.supported));
assert.equal(isTerritoryTypeSupported("birthday", "COUNTRY"), false);
assert.equal(isTerritoryTypeSupported("journal", "COUNTRY"), true);
assert.equal(isTerritoryTypeSupported("classes", "COUNTRY"), true);
assert.equal(defaultTerritorySlugForSection("journal"), "belarus");
assert.equal(defaultTerritorySlugForSection("kuda"), "minsk");
assert.equal(defaultTerritorySlugForSection("birthday"), "minsk");

assert.equal(parseTerritoryCookie("a=1; mg_territory=minsk; b=2"), "minsk");
assert.equal(parseTerritoryCookie("mg_territory=%3Cscript%3E"), null);
assert.equal(parseTerritoryCookie(null), null);
assert.match(serializeTerritoryCookie("belarus"), /^mg_territory=belarus; Path=\/; Max-Age=\d+; SameSite=Lax$/);
assert.throws(() => serializeTerritoryCookie("bad slug;"));

// Counting wiring: every section is queried, articles through the territory and its geography targets.
async function counting() {
  const seen: Record<string, unknown> = {};
  const delegate = (name: string, n: number) => ({ count: async (args: unknown) => ((seen[name] = [...((seen[name] as unknown[]) ?? []), args]), n) });
  const db = {
    activity: delegate("activity", 2), place: delegate("place", 3), offer: delegate("offer", 4),
    route: delegate("route", 5), article: delegate("article", 1),
  } as unknown as TerritoryCountsDb;
  const result = await countPublicContentForTerritory("t1", db);
  assert.deepEqual(result, { events: 2, classes: 4, places: 3, offers: 4, routes: 5, articles: 1 });
  assert.equal(totalSectionCounts(result), 19);
  assert.equal((seen.activity as unknown[]).length, 1, "events: one EVENT-activity query, as in the kuda feed");
  const offerQueries = (seen.offer as unknown[]).map((q) => JSON.stringify(q));
  assert.equal(offerQueries.length, 2);
  assert.ok(offerQueries[0].includes('"kind":"SERVICE"'), "classes = SERVICE offers, as in classesDiscoveryFeed");
  assert.ok(offerQueries[1].includes('"kind":{"not":"SERVICE"}'));
  assert.ok(!JSON.stringify(seen.activity).includes("COURSE"), "classes are not counted from activities");
  const articleWhere = JSON.stringify(seen.article);
  assert.ok(articleWhere.includes("additionalGeographyTargets") && articleWhere.includes("regionTerritoryId"));
}
counting().then(() => console.log("listAvailableTerritories.test: ok"));
