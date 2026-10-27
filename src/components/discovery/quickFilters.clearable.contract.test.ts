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

test("desktop custom-date chip clears without opening its picker", () => {
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
  assert.equal(dateParams.get("profile"), null);
  assert.equal(dateParams.get("occasion"), "halloween");
  assert.deepEqual(parseAppliedFromUrl(dateParams as never), { ...withoutDate, profile: null });
});

test("mobile who/age uses the same bottom-sheet model as date interval", () => {
  const who = file("./DiscoveryWhoFilter.tsx");
  const date = file("./EventDateRangePicker.tsx");
  assert.match(who, /if \(mobile\) \{/);
  assert.match(who, /<Sheet open=\{open\} onOpenChange=\{setOpen\}>/);
  assert.match(who, /<SheetTrigger asChild>/);
  assert.match(who, /<SheetContent side="bottom"/);
  assert.match(who, /<SheetTitle>Для кого<\/SheetTitle>/);
  assert.match(who, /<MobileOverlayResetAction disabled=\{!hasWhoFilter\}/);
  assert.match(who, /onClick=\{\(\) => clearWho\(false\)\}/);
  assert.match(who, /onClick=\{\(\) => setOpen\(false\)\}/);
  assert.match(date, /<SheetContent side="bottom"/);
});

test("mobile selected quick chips keep full-size pills without close X", () => {
  const clear = file("./ClearableQuickFilterChip.tsx");
  const who = file("./DiscoveryWhoFilter.tsx");
  const quick = file("./EventQuickFilters.tsx");
  const halloween = file("./HalloweenChip.tsx");
  const date = file("./EventDateRangePicker.tsx");
  assert.match(clear, /md:inline-flex/);
  assert.match(quick, /hidden h-3\.5 w-3\.5 md:block/);
  assert.match(halloween, /hidden h-4 w-4 shrink-0 md:block/);
  assert.match(date, /md:rounded-r-none md:pr-3/);
  const mobile = who.slice(who.indexOf("if (mobile)"), who.indexOf("return (\n    <Popover"));
  assert.ok(!mobile.includes("ClearableQuickFilterChip"), "mobile age trigger must not include a clear-action button");
});

test("free mode and absent family children always expose manual ages including #nokids", () => {
  const who = file("./DiscoveryWhoFilter.tsx");
  const ages = readFileSync(new URL("../../features/filters/age/ageGroups.ts", import.meta.url), "utf8");
  assert.match(who, /availableAgeValues=\{selected\.length \? facets\?\.ages \?\? null : null\}/);
  assert.match(who, /whoFreeMode=\{selected\.length === 0\}/);
  assert.match(ages, /label: "#nokids"[\s\S]*?value: "18\+"/);
  const manualAge = { ...defaultFilters, age: ["18+"], profile: null };
  const params = serializeAppliedToSearchParams(new URLSearchParams(), manualAge);
  assert.equal(params.get("age"), "18+");
  assert.equal(params.get("profile"), null);
  assert.deepEqual(parseAppliedFromUrl(params as never), manualAge);
});
