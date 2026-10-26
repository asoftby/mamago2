import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("mobile header is the sole primary-action style reference", () => {
  const header = source("./MobileSearchSheet.tsx");
  const primary = source("./MobileOverlayPrimaryAction.tsx");
  assert.match(header, /<MobileOverlayPrimaryAction onClick=\{handleBottomPrimaryClick\}>/);
  assert.match(primary, /rounded-xl bg-\[#EF8759\] px-5 py-3\.5 text-\[15px\] font-semibold/);
});

test("all mobile discovery and filter sheets share reset and show controls", () => {
  const paths = [
    "./MobileSearchSheet.tsx",
    "../discovery/DiscoveryWhoFilter.tsx",
    "../discovery/EventDateRangePicker.tsx",
    "../discovery/EventAdvancedFilters.tsx",
    "../discovery/MobileFilterSheet.tsx",
    "../filters/MobileDateSheet.tsx",
    "../filters/MobileSelectSheet.tsx",
  ];
  for (const path of paths) {
    const s = source(path);
    assert.match(s, /MobileOverlayResetAction/, path);
    assert.match(s, /MobileOverlayPrimaryAction/, path);
  }
});
