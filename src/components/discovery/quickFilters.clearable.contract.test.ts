import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  defaultFilters,
  parseAppliedFromUrl,
  serializeAppliedToSearchParams,
} from "@/features/filters/discovery/filters.store";

const file = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

test("Halloween is first, then who/age, then quick dates and interval", () => {
  const source = file("./EventQuickFilters.tsx");
  const halloween = source.indexOf("{halloweenEnabled && (");
  const who = source.indexOf("<DiscoveryWhoFilter />");
  const presets = source.indexOf("<ChipsRow");
  const interval = source.indexOf("<EventDateRangePicker");
  assert.ok(halloween >= 0 && halloween < who && who < presets && presets < interval);
});

test("selected age chip has its own clear button and resets family and URL together", () => {
  const source = file("./DiscoveryWhoFilter.tsx");
  assert.match(source, /<ClearableQuickFilterChip active=\{hasWhoFilter\}/);
  assert.match(source, /family\?\.setSelectedPersonaIds\(\[\]\)/);
  assert.match(source, /actions\.setDraft\(\{ age: \[\], profile: null, adultOnly: false \}\)/);
  assert.match(source, /applied\.profile/);
});

test("desktop and mobile custom-date chips clear without opening their pickers", () => {
  const source = file("./EventDateRangePicker.tsx");
  assert.equal((source.match(/clearLabel="Сбросить выбранные даты"/g) ?? []).length, 2);
  assert.match(source, /const clearDateRange = \(\) => \{\s*resetDateRange\(\);\s*setOpen\(false\)/);
  assert.match(source, /onApply\(\{ whenPreset: null, dateFrom: null, dateTo: null \}\)/);
  const clearable = file("./ClearableQuickFilterChip.tsx");
  assert.match(clearable, /event\.stopPropagation\(\)/);
  assert.match(clearable, /aria-label=\{clearLabel\}/);
  assert.match(clearable, /\{children\}[\s\S]*<button/);
});

test("all active quick date presets and Halloween show a remove icon", () => {
  const quick = file("./EventQuickFilters.tsx");
  const halloween = file("./HalloweenChip.tsx");
  assert.match(quick, /\{active && <X /);
  assert.match(quick, /whenPreset: active \? null : preset\.value, dateFrom: null, dateTo: null/);
  assert.match(halloween, /\{active && <X /);
});

test("clearing age or custom date preserves other selected facets in shareable URL", () => {
  const filters = {
    ...defaultFilters,
    occasionSlug: "halloween",
    age: ["3-5"],
    profile: "child-123",
    dateFrom: "2026-10-29",
    dateTo: "2026-10-31",
    categories: ["shows"],
  };
  const withoutWho = { ...filters, age: [], profile: null, adultOnly: false };
  const whoParams = serializeAppliedToSearchParams(new URLSearchParams(), withoutWho);
  assert.equal(whoParams.get("age"), null);
  assert.equal(whoParams.get("profile"), null);
  assert.equal(whoParams.get("occasion"), "halloween");
  assert.equal(whoParams.get("from"), "2026-10-29");
  assert.deepEqual(parseAppliedFromUrl(whoParams as never), withoutWho);

  const withoutDate = { ...filters, whenPreset: null, dateFrom: null, dateTo: null };
  const dateParams = serializeAppliedToSearchParams(new URLSearchParams(), withoutDate);
  assert.equal(dateParams.get("from"), null);
  assert.equal(dateParams.get("to"), null);
  assert.equal(dateParams.get("profile"), "child-123");
  assert.equal(dateParams.get("occasion"), "halloween");
  assert.deepEqual(parseAppliedFromUrl(dateParams as never), withoutDate);
});
