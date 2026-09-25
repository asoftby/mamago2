/**
 * Source-level responsive contract for public mobile surfaces.
 *
 * Protects the layout/overlay issues found in the 2026-09 mobile audit:
 * - fixed bottom nav clearance must be applied once, not before and after footer;
 * - refinement sheets must use dynamic viewport units and 44px touch targets;
 * - filter actions must stay reachable above the iOS safe area;
 * - My Plan/mobile menu sheets must keep 44px controls and dynamic heights;
 * - nested sheets must not render duplicate close buttons.
 *
 * Run: pnpm test:responsive-public-mobile
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const publicLayout = read("src/app/(public)/PublicLayoutBody.tsx");
const refinementModal = read("src/components/discovery/RefinementFiltersModal.tsx");
const eventFilters = read("src/components/discovery/EventAdvancedFilters.tsx");
const secondaryFilters = read("src/components/discovery/SecondaryFiltersForm.tsx");
const myPlanHeader = read("src/features/my-plan/components/MyPlanHeader.tsx");
const mobileMenuSheet = read("src/components/mobile/MobileMenuSheet.tsx");
const planSuggestionsSheet = read("src/features/my-plan/components/PlanSuggestionsSheet.tsx");

assert.match(
  publicLayout,
  /<main className="flex-1">/,
  "Public main content must not add a second mobile bottom-nav clearance",
);
assert.match(
  publicLayout,
  /<div className=\{cn\(!hideBottomBar \? MOBILE_MAIN_BOTTOM/,
  "Footer wrapper must keep the single mobile bottom-nav clearance",
);
assert.doesNotMatch(
  publicLayout,
  /<main[^>]*MOBILE_MAIN_BOTTOM/,
  "Mobile bottom-nav clearance must not be duplicated on <main>",
);

assert.match(
  refinementModal,
  /h-\[88dvh\]/,
  "Refinement filter sheet must size from the dynamic mobile viewport",
);
assert.match(
  refinementModal,
  /h-11 w-11 bg-gray-50/,
  "Refinement filter close target must be at least 44px",
);
assert.match(
  refinementModal,
  /px-4 pb-0 pt-3 sm:px-6/,
  "Refinement filter sheet must keep a wide 16px mobile content inset",
);

assert.match(
  eventFilters,
  /h-11 w-11[^"]*sm:h-9 sm:w-9/,
  "Price slider thumbs must expose 44px mobile touch targets",
);
assert.match(
  eventFilters,
  /sticky bottom-0[^"]*safe-area-inset-bottom/,
  "Event filter actions must stay sticky above the mobile safe area",
);
assert.match(
  eventFilters,
  /min-h-11 min-w-0 flex-1 rounded-full/,
  "Event filter primary action must remain a full 44px mobile target",
);

assert.match(
  secondaryFilters,
  /sticky bottom-0[^"]*safe-area-inset-bottom/,
  "Secondary filter actions must stay sticky above the mobile safe area",
);
assert.match(
  secondaryFilters,
  /min-h-11 min-w-\[8rem\]/,
  "Secondary filter apply action must remain a 44px mobile target",
);

assert.match(
  myPlanHeader,
  /width: compact \? 44 : 40/,
  "My Plan compact close button must be 44px wide",
);
assert.match(
  myPlanHeader,
  /height: compact \? 44 : 40/,
  "My Plan compact close button must be 44px high",
);

assert.match(
  mobileMenuSheet,
  /max-h-\[80dvh\]/,
  "Mobile menu sheet height must use the dynamic viewport",
);
assert.match(
  mobileMenuSheet,
  /className="h-11 w-11 bg-neutral-100/,
  "Mobile menu close target must be 44px",
);

assert.match(
  planSuggestionsSheet,
  /showCloseButton=\{false\}/,
  "Plan suggestions mobile sheet must not render a duplicate SheetContent close button",
);
assert.match(
  planSuggestionsSheet,
  /h-\[88dvh\][^"]*100dvh/,
  "Plan suggestions sheet must use the dynamic viewport",
);
assert.match(
  planSuggestionsSheet,
  /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/,
  "Plan suggestions primary action must clear the iOS safe area",
);
const suggestionNavTargets =
  planSuggestionsSheet.match(/inline-flex h-11 w-11 items-center justify-center/g) ?? [];
assert.ok(
  suggestionNavTargets.length >= 2,
  "Plan suggestions previous/next controls must both be 44px touch targets",
);

console.log("publicMobileLayoutContract.test.ts: OK");
