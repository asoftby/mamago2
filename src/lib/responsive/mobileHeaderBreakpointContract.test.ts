/**
 * Regression test for the mobile/tablet public UI breakpoint contract.
 *
 * Confirmed bug: MobileHeader switches to the desktop layout at `lg`
 * (>=1024px, see SiteHeader), but RefinementFiltersModal and
 * MobileSmartBackButton used `md:hidden` (>=768px). In the 768-1023px range
 * this meant MobileHeader (and MobileFilterButton inside it) were still the
 * mobile UI, while the filter bottom sheet and the detail-page back button
 * had already disappeared — MobileFilterButton could open state + a body
 * scroll lock with no visible sheet to close it from.
 *
 * No React test harness in this repo (no testing-library/jsdom) — same
 * source-text assertion technique as
 * src/app/admin/ranking/adminRankingReadOnlyUi.test.tsx: assert the exact
 * Tailwind breakpoint utility that gates each piece of mobile-only UI, so a
 * future edit can't silently reintroduce a breakpoint that diverges from
 * MobileHeader's `< lg` contract.
 *
 * Запуск: npx tsx src/lib/responsive/mobileHeaderBreakpointContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const mobileHeader = read("src/components/site/header/MobileHeader.tsx");
const siteHeader = read("src/components/site/header/SiteHeader.tsx");
const refinementFiltersModal = read(
  "src/components/discovery/RefinementFiltersModal.tsx",
);
const mobileSmartBackButton = read(
  "src/components/shared/MobileSmartBackButton.tsx",
);

// MobileHeader documents its own `< lg` viewport contract.
assert.match(
  mobileHeader,
  /Хедер для viewport \*\*&lt;\s*lg\*\*/,
  "MobileHeader must keep documenting its `< lg` viewport contract",
);

// SiteHeader is the single place that decides which header mounts at which
// breakpoint — both halves must agree on `lg`.
assert.match(
  siteHeader,
  /hidden\s+p-0\s+lg:contents/,
  "SiteHeader must gate DesktopHeader at `lg` (`hidden ... lg:contents`)",
);
assert.match(
  siteHeader,
  /contents\s+lg:hidden/,
  "SiteHeader must gate MobileHeader at `lg` (`contents lg:hidden`)",
);

// RefinementFiltersModal: the mobile bottom sheet must hide at the same
// breakpoint as MobileHeader, so MobileFilterButton (only rendered inside
// MobileHeader, i.e. `< lg`) never opens a sheet that's invisible on its own
// viewport.
assert.match(
  refinementFiltersModal,
  /fixed inset-0 z-\[9999\] lg:hidden/,
  "RefinementFiltersModal sheet must hide at `lg`, matching MobileHeader's `< lg` contract",
);
assert.doesNotMatch(
  refinementFiltersModal,
  /\bmd:hidden\b/,
  "RefinementFiltersModal must not gate mobile-only UI at `md` (768px) — that range is still inside MobileHeader's `< lg` contract",
);

// The sheet's body-scroll lock must be tied to viewport width too: crossing
// into desktop (>=1024px) while the sheet is open must close it and release
// the lock, instead of leaving `document.body.style.position = "fixed"`
// stuck because the state never transitions.
assert.match(
  refinementFiltersModal,
  /matchMedia\(\s*["']\(min-width:\s*1024px\)["']\s*\)/,
  "RefinementFiltersModal must watch for the >=1024px breakpoint and close itself (releasing the scroll lock) when the viewport crosses it while open",
);

// MobileSmartBackButton: same `< lg` contract as MobileHeader — the back
// button on detail pages must stay visible for as long as the mobile header
// is showing.
assert.match(
  mobileSmartBackButton,
  /\blg:hidden\b/,
  "MobileSmartBackButton must hide at `lg`, matching MobileHeader's `< lg` contract",
);
assert.doesNotMatch(
  mobileSmartBackButton,
  /\bmd:hidden\b/,
  "MobileSmartBackButton must not gate mobile-only UI at `md` (768px) — that range is still inside MobileHeader's `< lg` contract",
);

console.log("mobileHeaderBreakpointContract.test.ts: OK");
