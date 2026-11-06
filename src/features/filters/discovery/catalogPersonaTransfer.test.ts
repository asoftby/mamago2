import assert from "node:assert/strict";
import test from "node:test";
import { defaultFilters, mergeCatalogPersonaAge, parseAppliedFromUrl } from "./discoveryFilterParams";
import { readFileSync } from "node:fs";

test("explicit header persona choice transfers age without overwriting catalog options", () => {
  const previous = { ...defaultFilters, age: ["3-5"], whenPreset: "WEEKEND" as const,
    categories: ["master-classes"], free: true, adultOnly: true, profile: "old-private-id" };
  const next = mergeCatalogPersonaAge(previous, ["9-12"]);
  assert.deepEqual(next.age, ["9-12"]);
  assert.deepEqual(next.categories, previous.categories);
  assert.equal(next.whenPreset, "WEEKEND");
  assert.equal(next.free, true);
  assert.equal(next.profile, null);
  assert.equal(next.adultOnly, false, "old adult-only gate must not block selected child");
  assert.deepEqual(previous.age, ["3-5"]);
});

test("free search clears only inherited age, including on immediate navigation", () => {
  const previous = { ...defaultFilters, age: ["18+"], district: "old-district" };
  assert.deepEqual(mergeCatalogPersonaAge(previous, []).age, []);
  assert.equal(mergeCatalogPersonaAge(previous, []).district, "old-district");
  assert.deepEqual(mergeCatalogPersonaAge(null, ["9-12"]).age, ["9-12"]);
});

test("catalog URL never receives family identity and explicit shared age remains authoritative", () => {
  const url = new URLSearchParams("profile=private-child&age=9-12&preset=TOMORROW");
  const parsed = parseAppliedFromUrl(url);
  assert.deepEqual(parsed.age, ["9-12"]);
  assert.equal(parsed.profile, null);
  const code = readFileSync(new URL("./filters.store.ts", import.meta.url), "utf8");
  assert.match(code, /persistPersonaAudience:/);
  assert.match(code, /mergeCatalogPersonaAge\(previous, age\)/);
});

test('nine-year-old selected child exposes both inclusive age chips', async () => {
  const { deriveAgeRangesFromChildren } = await import('./childrenScope.store');
  const year = new Date().getFullYear() - 9;
  const rows = [{ id: 'child-a', name: 'Child', birthDate: `${year}-01-01` }];
  const ages = deriveAgeRangesFromChildren(rows, ['child-a']).map(row => row.range);
  assert.deepEqual(ages, ['7-9', '9-12']);
});
