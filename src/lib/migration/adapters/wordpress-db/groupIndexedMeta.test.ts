import assert from "node:assert/strict";

import { groupIndexedMeta } from "./groupIndexedMeta";

const FIELDS = ["title", "description", "images"] as const;

function testBasicGrouping() {
  const { groups, warnings } = groupIndexedMeta(
    {
      "title-location-1": ["Secret Beach"],
      "description-location-1": ["A quiet spot"],
      "images-location-1": ["100,101"],
      "title-location-2": ["Old Church"],
      "description-location-2": ["Historic site"],
      "images-location-2": ["102"],
    },
    [...FIELDS],
    "location",
  );

  assert.deepEqual(warnings, []);
  assert.deepEqual(groups, [
    { index: 1, values: { title: "Secret Beach", description: "A quiet spot", images: "100,101" } },
    { index: 2, values: { title: "Old Church", description: "Historic site", images: "102" } },
  ]);
}

function testNumericOrderingNotStringOrdering() {
  const { groups } = groupIndexedMeta(
    {
      "title-location-2": ["Two"],
      "title-location-10": ["Ten"],
      "title-location-1": ["One"],
    },
    [...FIELDS],
    "location",
  );

  assert.deepEqual(
    groups.map((g) => g.index),
    [1, 2, 10],
  );
}

function testPartialGroupsAndMissingIndices() {
  const { groups } = groupIndexedMeta(
    {
      "title-location-3": ["Only title, no description or images"],
      "title-location-5": ["Stop five title"],
      "description-location-5": ["Stop five description"],
    },
    [...FIELDS],
    "location",
  );

  // No index 4 was synthesized — only indices actually present appear.
  assert.deepEqual(
    groups.map((g) => g.index),
    [3, 5],
  );
  assert.deepEqual(groups[0].values, { title: "Only title, no description or images" });
  assert.deepEqual(groups[1].values, { title: "Stop five title", description: "Stop five description" });
}

function testUnknownKeysIgnoredSilently() {
  const { groups, warnings } = groupIndexedMeta(
    {
      "title-location-1": ["Stop one"],
      rank_math_primary_route_budget: ["0"],
      location: ['{"address":"x"}'],
      text: ["https://maps.example.com"],
      "story conclusion": ["<p>The end</p>"],
    },
    [...FIELDS],
    "location",
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(warnings, []);
}

function testUnsuffixedKeyExcludedWithWarning() {
  // Confirmed real-data edge case (WP post 29290, live inspection
  // 2026-07-13): a bare `title-location` key duplicating an already
  // numbered stop's content, not a genuine extra stop. Must never be
  // folded in as a phantom index.
  const { groups, warnings } = groupIndexedMeta(
    {
      "title-location": ["Duplicate of stop 10"],
      "title-location-10": ["Real stop 10"],
    },
    [...FIELDS],
    "location",
  );

  assert.deepEqual(
    groups.map((g) => g.index),
    [10],
  );
  assert.equal(groups[0].values.title, "Real stop 10");
  const warning = warnings.find((w) => w.code === "ROUTE_META_KEY_UNPARSEABLE_INDEX");
  assert.ok(warning);
  assert.equal(warning?.details?.key, "title-location");
}

function testMalformedNonNumericSuffixExcludedWithWarning() {
  const { groups, warnings } = groupIndexedMeta(
    { "title-location-abc": ["Bad suffix"] },
    [...FIELDS],
    "location",
  );

  assert.equal(groups.length, 0);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, "ROUTE_META_KEY_UNPARSEABLE_INDEX");
  assert.equal(warnings[0].details?.key, "title-location-abc");
}

function testDuplicateMetaKeyValuesWarnAndKeepFirst() {
  const { groups, warnings } = groupIndexedMeta(
    { "title-location-1": ["First value", "Second value"] },
    [...FIELDS],
    "location",
  );

  assert.equal(groups[0].values.title, "First value");
  const warning = warnings.find((w) => w.code === "ROUTE_META_KEY_DUPLICATE");
  assert.ok(warning);
  assert.deepEqual(warning?.details?.values, ["First value", "Second value"]);
}

function testEmptyValuesExcludedFromGroup() {
  const { groups } = groupIndexedMeta(
    {
      "title-location-1": ["Stop one"],
      "description-location-1": [""],
      "images-location-1": ["   "],
    },
    [...FIELDS],
    "location",
  );

  assert.deepEqual(groups[0].values, { title: "Stop one" });
}

function testEmptyInputProducesNoGroups() {
  const { groups, warnings } = groupIndexedMeta({}, [...FIELDS], "location");
  assert.deepEqual(groups, []);
  assert.deepEqual(warnings, []);
}

function main() {
  testBasicGrouping();
  testNumericOrderingNotStringOrdering();
  testPartialGroupsAndMissingIndices();
  testUnknownKeysIgnoredSilently();
  testUnsuffixedKeyExcludedWithWarning();
  testMalformedNonNumericSuffixExcludedWithWarning();
  testDuplicateMetaKeyValuesWarnAndKeepFirst();
  testEmptyValuesExcludedFromGroup();
  testEmptyInputProducesNoGroups();
}

main();
console.log("groupIndexedMeta tests: OK");
