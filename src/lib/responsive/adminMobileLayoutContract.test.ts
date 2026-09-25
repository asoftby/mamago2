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
 *   multi-word labels into illegible 3-up columns.
 *
 * Run: pnpm test:responsive-admin
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const layout = read("src/app/admin/layout.tsx");
const header = read("src/components/admin/AdminHeader.tsx");
const bottomSheet = read("src/components/ui/bottom-sheet.tsx");
const orders = read("src/app/admin/orders/AdminOrdersClient.tsx");
const verificationPanel = read("src/app/admin/b2b/requests/BusinessVerificationSidePanel.tsx");
const importReviewTable = read("src/app/admin/import/review/_components/ReviewQueueTableClient.tsx");
const dashboardBlocks = [
  "src/app/admin/_components/blocks/B2BHealthBlock.tsx",
  "src/app/admin/_components/blocks/HabitBlock.tsx",
  "src/app/admin/_components/blocks/FunnelBlock.tsx",
  "src/app/admin/_components/blocks/SearchDiscoveryBlock.tsx",
  "src/app/admin/_components/blocks/GrowthBlock.tsx",
  "src/app/admin/_components/blocks/ProductPulseBlock.tsx",
  "src/app/admin/_components/blocks/TrafficBlock.tsx",
  "src/app/admin/_components/blocks/SupplyHealthBlock.tsx",
].map(read);

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

console.log("adminMobileLayoutContract.test.ts: OK");
