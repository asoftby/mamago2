import assert from "node:assert/strict";
import { assertArticleGeographyTargetShape, buildArticleCityDiscoveryWhere } from "./articleGeographyTargets";

const where = buildArticleCityDiscoveryWhere({ id: "minsk", regionId: "minsk-region" });
assert.deepEqual(where.OR, [
  { geoScope: "CITY", cityId: "minsk" },
  { geoScope: "REGION", regionId: "minsk-region" },
  { additionalGeographyTargets: { some: { OR: [
    { type: "CITY", cityId: "minsk" },
    { type: "REGION", regionId: "minsk-region" },
  ] } } },
]);

assert.doesNotThrow(() => assertArticleGeographyTargetShape(
  [{ type: "CITY", cityId: "city-in-primary-region" }],
  { geoScope: "REGION", cityId: null, regionId: "primary-region" },
));
assert.throws(() => assertArticleGeographyTargetShape(
  [{ type: "CITY", cityId: "primary-city" }],
  { geoScope: "CITY", cityId: "primary-city", regionId: null },
), /Основная география/);
assert.throws(() => assertArticleGeographyTargetShape(
  [{ type: "REGION", regionId: "r" }, { type: "REGION", regionId: "r" }],
  { geoScope: "COUNTRY", cityId: null, regionId: null },
), /не должны повторяться/);

console.log("articleGeographyTargets.test.ts: OK");
