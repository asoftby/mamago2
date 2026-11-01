import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const city = readFileSync(new URL("../city/CityDiscoveryShell.tsx", import.meta.url), "utf8");
const chips = readFileSync(new URL("./EventQuickFilters.tsx", import.meta.url), "utf8");
const desktop = readFileSync(new URL("./RefinementFiltersButtonCompact.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../mobile/MobileFilterButton.tsx", import.meta.url), "utf8");

assert.match(city, /<div className="flex items-center justify-between gap-3">\s*<H1[^>]*><CityTitle/);
assert.match(city, /\{filterButton\}/);
assert.match(chips, /!mt-0 flex items-center gap-3 overflow-x-auto scroll-smooth pb-0 pt-0/);
assert.doesNotMatch(chips, /scroll-smooth pb-3 pt-0/);
assert.ok(desktop.includes("h-[5px] w-[5px] rounded-full bg-red-500"));
assert.match(mobile, /SlidersHorizontal/);
console.log("Afisha title / quick filters presentation: OK");
