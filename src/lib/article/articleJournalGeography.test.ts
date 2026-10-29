import assert from "node:assert/strict";
import {
  buildJournalGeographyBuckets,
  buildJournalGeographyBucketsByTerritory,
  JOURNAL_GROUPS,
  JOURNAL_GROUP_LABELS,
} from "./articleJournalGeography";

const city = { id: "minsk-id", regionId: "minsk-region-id" };
const buckets = buildJournalGeographyBuckets(city);

assert.deepEqual(buckets.map(bucket => bucket.group), JOURNAL_GROUPS);
assert.deepEqual(buckets[0].where, {
  OR: [
    { geoScope: "CITY", cityId: "minsk-id" },
    { additionalGeographyTargets: { some: { type: "CITY", cityId: "minsk-id" } } },
  ],
});
assert.equal((buckets[1].where as { AND: unknown[] }).AND.length, 2);
assert.equal((buckets[2].where as { AND: unknown[] }).AND.length, 3);
assert.equal(JOURNAL_GROUP_LABELS.OTHER_CITY, "Другие города Беларуси");

const noRegion = buildJournalGeographyBuckets({ id: "minsk-id" });
assert.deepEqual(noRegion[1].where, { AND: [{ id: { in: [] } }, { NOT: noRegion[0].where }] });

// Territory buckets: the region group also holds articles of the other cities of the region.
const byTerritory = buildJournalGeographyBucketsByTerritory({
  cityTerritoryId: "ter-minsk",
  regionTerritoryId: "ter-region-minsk",
  regionScopeIds: ["ter-region-minsk", "ter-minsk", "ter-marina-gorka"],
});
assert.deepEqual(byTerritory.map(bucket => bucket.group), JOURNAL_GROUPS);
assert.deepEqual(byTerritory[0].where, {
  OR: [
    { geoScope: "CITY", territoryId: "ter-minsk" },
    { additionalGeographyTargets: { some: { type: "CITY", territoryId: "ter-minsk" } } },
  ],
});
const regionJson = JSON.stringify(byTerritory[1].where);
assert.ok(regionJson.includes('"geoScope":"CITY","territoryId":{"in":["ter-region-minsk","ter-minsk","ter-marina-gorka"]}'));
assert.ok(regionJson.includes('"regionTerritoryId":"ter-region-minsk"'));
assert.equal((byTerritory[2].where as { AND: unknown[] }).AND.length, 3);

const noTerritoryRegion = buildJournalGeographyBucketsByTerritory({ cityTerritoryId: null, regionTerritoryId: null, regionScopeIds: [] });
assert.deepEqual(noTerritoryRegion[0].where, { id: { in: [] } }, "country page has no city bucket");
assert.deepEqual(noTerritoryRegion[1].where, { AND: [{ id: { in: [] } }, { NOT: { id: { in: [] } } }] });

console.log("articleJournalGeography.test.ts: OK");
