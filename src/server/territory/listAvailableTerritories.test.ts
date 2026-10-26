/**
 * Run: pnpm exec tsx src/server/territory/listAvailableTerritories.test.ts
 */
import assert from "node:assert/strict";
import { buildAvailableTerritories } from "./listAvailableTerritories";
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
  r("cb", "CITY", "brest", "rb"), // no events/places -> not in legacy visible set
];
const visible = new Set(["minsk", "kopishche", "grodno", "mir"]);

const list = buildAvailableTerritories(rows, visible, null);
assert.deepEqual(
  list.map((t) => `${t.type}:${t.slug}`),
  ["COUNTRY:belarus", "REGION:minsk", "CITY:kopishche", "REGION:grodno"],
  "country first; centre city folded into its region; hidden/empty entries dropped; region without listed cities dropped",
);
assert.equal(list[0].path, "/belarus");

const birthday = buildAvailableTerritories(rows, visible, "birthday");
assert.deepEqual(birthday.map((t) => t.supported), [false, true, true, true], "birthday does not support the whole country");
assert.ok(buildAvailableTerritories(rows, visible, "kuda").every((t) => t.supported));
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
console.log("listAvailableTerritories.test: ok");
