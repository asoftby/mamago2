import assert from "node:assert/strict";
import { buildJournalGeographyBuckets, JOURNAL_GROUPS, JOURNAL_GROUP_LABELS } from "./articleJournalGeography";

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

console.log("articleJournalGeography.test.ts: OK");
