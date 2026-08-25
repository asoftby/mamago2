/**
 * Regression coverage for the guest-401 / duplicate-request fix on
 * /api/save/status. SaveHeart, PlaceSaveHeart, ArticleSaveHeart,
 * OfferPageView, EventPageView and ConversionEventPageView all gate their
 * account-specific status fetch through these two pure functions — see
 * saveStatusFetchGuard.ts for why they're pure (no jsdom/RTL in this repo's
 * test harness, so effect timing itself isn't directly testable).
 *
 * Run: npx tsx src/features/save/saveStatusFetchGuard.test.ts
 */
import assert from "node:assert/strict";
import { shouldFetchOwnSaveStatus, shouldRefetchAfterFlowClose } from "./saveStatusFetchGuard";

// ── Guest never triggers the account-specific status fetch ─────────────────
assert.equal(
  shouldFetchOwnSaveStatus(false),
  false,
  "guest (status !== authenticated) must not call /api/save/status",
);

// ── Authenticated user does trigger it ──────────────────────────────────────
assert.equal(
  shouldFetchOwnSaveStatus(true),
  true,
  "authenticated user must still call /api/save/status to load isIdea/inPlan/planDate/planStartsAt/planItemId",
);

// ── No duplicate fetch on initial mount (save-flow modal starts closed) ────
assert.equal(
  shouldRefetchAfterFlowClose({ flowOpen: false, hasOpenedOnce: false }),
  false,
  "on first render the mount effect already loaded status once — the flow-close effect must not fire a second GET",
);

// ── While the save-flow modal is open, never refetch (would cause a flicker) ─
assert.equal(
  shouldRefetchAfterFlowClose({ flowOpen: true, hasOpenedOnce: true }),
  false,
  "must not refetch while the modal is still open",
);

// ── After the user actually opened and closed the modal, refetch once ──────
assert.equal(
  shouldRefetchAfterFlowClose({ flowOpen: false, hasOpenedOnce: true }),
  true,
  "after a real open/close cycle, status must be refreshed (idea/plan state may have changed)",
);

console.log("saveStatusFetchGuard.test.ts: OK");
