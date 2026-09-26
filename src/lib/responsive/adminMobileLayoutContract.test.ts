/**
 * Responsive contract for the Admin section.
 *
 * Protects the mobile/tablet UX decisions from the 2026-09 Admin responsive
 * audit:
 * - admin shell keeps the `lg` sidebar/drawer breakpoint contract;
 * - mobile nav drawer exposes a 44px hamburger trigger and forwards the same
 *   moderation/import/review badge counts as the desktop sidebar;
 * - the shared BottomSheet primitive (admin nav drawer, and other mobile
 *   sheets built on it) uses the dynamic viewport and clears the bottom
 *   safe area;
 * - Orders — the first operational table in this pass — has a genuine
 *   mobile card fallback, not just horizontal scroll;
 * - the B2B verification side panel is a real dismissible Sheet (dvh + safe
 *   area + focus trap), not a hand-rolled overlay;
 * - the Import review bulk-action bar clears the mobile home-indicator area
 *   and stacks instead of squeezing two buttons into ~90vw;
 * - dashboard KPI trio grids stack on phone widths instead of wrapping
 *   multi-word labels into illegible 3-up columns;
 * - page-level Admin spacing is mobile-first (`p-4 sm:p-6`: 16px phone /
 *   24px sm+), not the legacy inverted `p-6 md:p-4` (24px phone / 16px
 *   md+) from the 2026-09-26 spacing cleanup. Nested card/panel padding
 *   (e.g. `bg-white border rounded-lg p-6 md:p-4`) is intentionally out of
 *   scope for that cleanup (see BACKLOG-157) and is excluded from the scan
 *   below via its `bg-white` marker, not treated as a page-level offender.
 *
 * Run: pnpm test:responsive-admin
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const read = (path: string) => readFileSync(path, "utf8");

/** Recursively collects .tsx/.ts files under a directory. */
function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scans admin source for the legacy inverted page-gutter pattern.
 * A line is a page-level offender only if it contains the legacy class pair
 * WITHOUT the `bg-white` nested-card marker — mirrors the exact heuristic
 * used to apply the 2026-09-26 cleanup, so a legitimate nested card (which
 * keeps `bg-white border ... rounded-lg p-6 md:p-4`, see BACKLOG-157) is not
 * flagged as a page-root regression.
 */
function findLegacyPageGutterOffenders(root: string): string[] {
  const offenders: string[] = [];
  for (const file of collectSourceFiles(root)) {
    const lines = read(file).split("\n");
    lines.forEach((line, index) => {
      if (line.includes("p-6 md:p-4") && !line.includes("bg-white")) {
        offenders.push(`${file}:${index + 1}`);
      }
    });
  }
  return offenders;
}

const layout = read("src/app/admin/layout.tsx");
const header = read("src/components/admin/AdminHeader.tsx");
const bottomSheet = read("src/components/ui/bottom-sheet.tsx");
const orders = read("src/app/admin/orders/AdminOrdersClient.tsx");
const verificationPanel = read("src/app/admin/b2b/requests/BusinessVerificationSidePanel.tsx");
const importReviewTable = read("src/app/admin/import/review/_components/ReviewQueueTableClient.tsx");
const dashboardBlocks = [
  "src/app/admin/_components/growth/ValuePathBlock.tsx",
  "src/app/admin/_components/growth/SupplyPartnersBlock.tsx",
  "src/app/admin/_components/blocks/TrafficBlock.tsx",
].map(read);
const growthKpiTiles = read("src/app/admin/_components/growth/GrowthKpiTiles.tsx");
const billingBusinesses = read("src/app/admin/billing/businesses/BillingBusinessesClient.tsx");
const contractsPage = read("src/app/admin/commercial/contracts/page.tsx");

// --- Admin shell breakpoint contract -------------------------------------

assert.match(
  layout,
  /hidden lg:block bg-white border-r border-gray-200/,
  "Desktop admin sidebar must stay hidden below lg (mobile uses the drawer)",
);

// --- Mobile hamburger touch target ----------------------------------------

assert.match(
  header,
  /lg:hidden shrink-0 -ml-2 flex h-11 w-11 items-center justify-center rounded-lg/,
  "Admin mobile nav trigger must expose a 44px touch target",
);

// --- Mobile drawer badge-count parity (regression: was silently defaulting to 0) ---

assert.match(
  layout,
  /<AdminHeader\s+userEmail=\{user\.email \|\| undefined\}[\s\S]*?importPendingReviewCount=\{importPendingReviewCount\}[\s\S]*?reviewsPendingCount=\{reviewsPendingCount\}[\s\S]*?\/>/,
  "Admin layout must forward importPendingReviewCount/reviewsPendingCount to AdminHeader",
);
assert.match(
  header,
  /importPendingReviewCount\?: number;\s*\n\s*reviewsPendingCount\?: number;/,
  "AdminHeader must accept importPendingReviewCount/reviewsPendingCount props",
);
assert.match(
  header,
  /<AdminSidebar\s+moderationCounts=\{moderationCounts\}\s*\n\s*b2bPendingVerificationCount=\{b2bPendingVerificationCount\}\s*\n\s*importPendingReviewCount=\{importPendingReviewCount\}\s*\n\s*reviewsPendingCount=\{reviewsPendingCount\}/,
  "Mobile AdminSidebar (inside the drawer) must receive the same badge counts as the desktop sidebar",
);

// --- Shared BottomSheet: dynamic viewport + safe area ---------------------

assert.match(
  bottomSheet,
  /height = "85dvh"/,
  "BottomSheet must default to the dynamic viewport height, not a static vh unit",
);
assert.match(
  bottomSheet,
  /overflow-y-auto bg-white pb-\[env\(safe-area-inset-bottom\)\]/,
  "BottomSheet content must clear the bottom safe area",
);

// --- Orders: mobile card fallback (Pattern A+B) ---------------------------

assert.match(
  orders,
  /hidden md:block overflow-hidden rounded-lg border border-gray-200 bg-white/,
  "Orders desktop table must be hidden below md so the mobile card list takes over",
);
assert.match(
  orders,
  /<TableContainer\s+minWidthClassName="min-w-\[900px\]"/,
  "Orders desktop table must keep the scrollable TableContainer affordance",
);
assert.match(
  orders,
  /<DataCardList>[\s\S]*?ordersData\.orders\.map/,
  "Orders must render a DataCardList reading the same orders array for mobile",
);

// --- B2B verification side panel: real Sheet, not a hand-rolled overlay ---

assert.doesNotMatch(
  verificationPanel,
  /fixed inset-0 bg-black\/20/,
  "Verification side panel must not hand-roll its own overlay div",
);
assert.match(
  verificationPanel,
  /<Sheet open onOpenChange=\{\(open\) => \{ if \(!open\) onClose\(\); \}\}>/,
  "Verification side panel must be a dismissible Sheet wired to onClose",
);
assert.match(
  verificationPanel,
  /className="flex h-dvh w-full flex-col gap-0 border-l bg-white p-0 sm:max-w-2xl"/,
  "Verification side panel must use the dynamic viewport height",
);
assert.match(
  verificationPanel,
  /pb-\[calc\(1\.5rem\+env\(safe-area-inset-bottom\)\)\]/,
  "Verification side panel content must clear the bottom safe area",
);

// --- Import review bulk-action bar: safe area + stacks on narrow screens ---

assert.match(
  importReviewTable,
  /fixed bottom-\[calc\(1rem\+env\(safe-area-inset-bottom\)\)\]/,
  "Import review bulk-action bar must clear the bottom safe area",
);
assert.match(
  importReviewTable,
  /flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl sm:flex-row sm:items-center sm:justify-between/,
  "Import review bulk-action bar must stack instead of squeezing two buttons into ~90vw",
);

// --- Dashboard KPI trio grids: stack on phone widths ----------------------

for (const block of dashboardBlocks) {
  assert.doesNotMatch(
    block,
    /className="grid grid-cols-3/,
    "Dashboard KPI trio grids must not force 3 columns below sm (long RU labels wrap illegibly at 320-375px)",
  );
  assert.match(
    block,
    /grid-cols-1[^"]*sm:grid-cols-3/,
    "Dashboard KPI trio grids must stack to 1 column below sm and expand to 3 at sm+",
  );
}

assert.match(
  growthKpiTiles,
  /grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4/,
  "Growth KPI tiles must stack on phones, go 2-up at sm and 4-up only at lg",
);

// --- Admin page header actions: stack below title on mobile -----------------

for (const [name, source, label] of [
  ["billing businesses", billingBusinesses, "Пополнить баланс"],
  ["contracts", contractsPage, "Создать договор"],
] as const) {
  assert.match(
    source,
    /flex flex-col gap-4 md:flex-row md:items-start md:justify-between/,
    `${name} header action must stack below the title on mobile and return to the right at md+`,
  );
  assert.match(
    source,
    /w-full[^"]*bg-primary[^"]*text-primary-foreground[^"]*md:w-auto/,
    `${name} primary action must be full-width on mobile and compact at md+`,
  );
  assert.equal(
    source.includes(label),
    true,
    `${name} primary action label must remain visible`,
  );
}

// --- Page-level spacing contract: mobile-first, legacy pattern must not return ---

const legacyPageGutterOffenders = [
  ...findLegacyPageGutterOffenders("src/app/admin"),
  ...findLegacyPageGutterOffenders("src/components/admin"),
];
assert.deepEqual(
  legacyPageGutterOffenders,
  [],
  `Legacy inverted page-gutter pattern (p-6 md:p-4 — 24px phone / 16px md+) found outside nested cards:\n${legacyPageGutterOffenders.join("\n")}`,
);

const representativeAdminPages = [
  "src/app/admin/orders/page.tsx",
  "src/app/admin/users/page.tsx",
  "src/app/admin/seo/layout.tsx",
  "src/app/admin/_components/AdminDashboardShell.tsx",
  "src/components/admin/discovery/discoveryTaxonomyClasses.ts",
].map(read);
for (const page of representativeAdminPages) {
  assert.match(
    page,
    /p-4 sm:p-6/,
    "Representative Admin page roots must use the mobile-first p-4 sm:p-6 gutter",
  );
}

const uiLabLayoutContract = read("src/app/(ui)/ui-lab-admin/_sections/LayoutContractSection.tsx");
assert.match(
  uiLabLayoutContract,
  /\/\/ AdminPageContainer\n<div className="p-4 sm:p-6 space-y-6">/,
  "UI Lab's AdminPageContainer example must demonstrate the current mobile-first contract",
);

console.log("adminMobileLayoutContract.test.ts: OK");
