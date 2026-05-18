# API Error Message Hardening — Phase 1

**Scope:** `src/app/api/auth/**` and `src/app/api/admin/**`

**Goal:** Prevent internal error details (stack traces, DB messages, service internals) from leaking to the HTTP response. All unexpected errors now return a generic message to the client while preserving full details in `console.error`.

---

## Auth Routes

**Status: ✅ Already clean — 0 leaks found**

All auth routes (`login`, `register`, `logout`, `me`, `verify-email`, `resend-verification-email`, `complete-registration`, `phone/send-otp`, `phone/verify-otp`) already return generic error messages. No changes needed.

---

## Admin Routes — Fixed (14 files)

| # | Route | Change |
|---|-------|--------|
| 1 | [`admin/promote/route.ts`](../../src/app/api/admin/promote/route.ts) | Removed `error instanceof Error ? error.message : "..."` → hardcoded `"Внутренняя ошибка сервера"` |
| 2 | [`admin/pages/[id]/route.ts`](../../src/app/api/admin/pages/[id]/route.ts) | PATCH: removed `error instanceof Error ? error.message : "Failed to update page"` → `"Failed to update page"` |
| 3 | [`admin/pages/[id]/route.ts`](../../src/app/api/admin/pages/[id]/route.ts) | DELETE: removed `error instanceof Error ? error.message : "Failed to archive page"` → `"Failed to archive page"` |
| 4 | [`admin/pages/route.ts`](../../src/app/api/admin/pages/route.ts) | POST: removed `error instanceof Error ? error.message : "Failed to create page"` → `"Failed to create page"` |
| 5 | [`admin/places/claims/[id]/approve/route.ts`](../../src/app/api/admin/places/claims/[id]/approve/route.ts) | Removed `error instanceof Error ? error.message : "Failed to approve claim"` → `"Failed to approve claim"` |
| 6 | [`admin/places/claims/[id]/reject/route.ts`](../../src/app/api/admin/places/claims/[id]/reject/route.ts) | Removed `error instanceof Error ? error.message : "Failed to reject claim"` → `"Failed to reject claim"` |
| 7 | [`admin/places/[id]/approve/route.ts`](../../src/app/api/admin/places/[id]/approve/route.ts) | Removed `error instanceof Error ? error.message : "Failed to approve place"` → `"Failed to approve place"` |
| 8 | [`admin/places/[id]/needs-changes/route.ts`](../../src/app/api/admin/places/[id]/needs-changes/route.ts) | Removed `error instanceof Error ? error.message : "Failed to request changes"` → `"Failed to request changes"` |
| 9 | [`admin/places/[id]/reject/route.ts`](../../src/app/api/admin/places/[id]/reject/route.ts) | Removed `error instanceof Error ? error.message : "Failed to reject place"` → `"Failed to reject place"` |
| 10 | [`admin/places/[id]/assign-owner/route.ts`](../../src/app/api/admin/places/[id]/assign-owner/route.ts) | Removed `error instanceof Error ? error.message : "Failed to assign owner"` → `"Failed to assign owner"` |
| 11 | [`admin/business-verification/[id]/approve/route.ts`](../../src/app/api/admin/business-verification/[id]/approve/route.ts) | Removed `error instanceof Error ? error.message : "..."` → hardcoded `"Внутренняя ошибка сервера"` |
| 12 | [`admin/business-verification/[id]/needs-info/route.ts`](../../src/app/api/admin/business-verification/[id]/needs-info/route.ts) | Removed `error instanceof Error ? error.message : "..."` → hardcoded `"Внутренняя ошибка сервера"` |
| 13 | [`admin/business-verification/[id]/reject/route.ts`](../../src/app/api/admin/business-verification/[id]/reject/route.ts) | Removed `error instanceof Error ? error.message : "..."` → hardcoded `"Внутренняя ошибка сервера"` |
| 14 | [`admin/demote/route.ts`](../../src/app/api/admin/demote/route.ts) | Removed `error instanceof Error ? error.message : "..."` → hardcoded `"Внутренняя ошибка сервера"` |
| 15 | [`admin/billing/refund/route.ts`](../../src/app/api/admin/billing/refund/route.ts) | Replaced `{ error: error.message }` with `{ error: "Failed to create refund" }` (kept `REFUND_AMOUNT_EXCEEDS_ORIGINAL` business error intact) |

---

## Admin Routes — Left Intentionally (control flow only, no leak)

These routes use `error.message` **only for control flow** (checking error type) and never return the raw message to the client:

| Route | Usage | Why safe |
|-------|-------|----------|
| [`admin/users/route.ts`](../../src/app/api/admin/users/route.ts) | `error.message?.includes("NEXT_REDIRECT")`, `error.message === "Insufficient permissions"` | Only checks message to determine status code; response has hardcoded `"Unauthorized"` / `"Failed to fetch users"` |
| [`admin/users/[id]/route.ts`](../../src/app/api/admin/users/[id]/route.ts) | `error.message.includes("NEXT_REDIRECT")`, `error.message === "User not found"`, `error.message === "Insufficient permissions"` | Only checks message to determine status code; response has hardcoded `"Unauthorized"` / `"Failed to fetch user details"` |
| [`admin/users/[id]/moderate/route.ts`](../../src/app/api/admin/users/[id]/moderate/route.ts) | `error.message.includes("NEXT_REDIRECT")`, `error.message === "User not found"`, `error.message === "Insufficient permissions"` | Only checks message to determine status code; response has hardcoded `"Unauthorized"` / `"Failed to perform moderation action"` |
| [`admin/analytics/content-performance/route.ts`](../../src/app/api/admin/analytics/content-performance/route.ts) | `error.message.includes("NEXT_REDIRECT")` | Only checks for redirect; response is generic |
| [`admin/analytics/funnels/route.ts`](../../src/app/api/admin/analytics/funnels/route.ts) | `error.message.includes("NEXT_REDIRECT")` | Only checks for redirect; response is generic |
| [`admin/analytics/overview/route.ts`](../../src/app/api/admin/analytics/overview/route.ts) | `error.message.includes("NEXT_REDIRECT")` | Only checks for redirect; response is generic |
| [`admin/analytics/segments/route.ts`](../../src/app/api/admin/analytics/segments/route.ts) | `error.message.includes("NEXT_REDIRECT")` | Only checks for redirect; response is generic |
| [`admin/analytics/segments/[segmentKey]/route.ts`](../../src/app/api/admin/analytics/segments/[segmentKey]/route.ts) | `error.message.includes("NEXT_REDIRECT")` | Only checks for redirect; response is generic |
| [`admin/analytics/behavior/route.ts`](../../src/app/api/admin/analytics/behavior/route.ts) | `error.message.includes("NEXT_REDIRECT")` | Only checks for redirect; response is generic |
| [`admin/places/[id]/improvement-request/route.ts`](../../src/app/api/admin/places/[id]/improvement-request/route.ts) | `error.message.startsWith("ACTIVE_REQUEST_EXISTS:")` | Only checks for a specific business error prefix; response returns controlled `"ACTIVE_REQUEST_EXISTS"` code |
| [`admin/places/[id]/sync-google-reviews/route.ts`](../../src/app/api/admin/places/[id]/sync-google-reviews/route.ts) | `error instanceof Error ? error.message : String(error)` | Used only in `console.error` logging, never returned to client |

---

## Admin Routes — Require Manual Analysis

| Route | Reason |
|-------|--------|
| [`admin/promote/route.ts`](../../src/app/api/admin/promote/route.ts) | ✅ Fixed |
| [`admin/demote/route.ts`](../../src/app/api/admin/demote/route.ts) | ✅ Fixed |
| [`admin/billing/refund/route.ts`](../../src/app/api/admin/billing/refund/route.ts) | ✅ Fixed (kept `REFUND_AMOUNT_EXCEEDS_ORIGINAL` business error — intentional 400) |

No routes remain that require manual analysis within the current scope.

---

## Verification

- **`pnpm lint`** — 0 new errors from modified files (all 564 pre-existing issues are unrelated)
- **`pnpm tsc --noEmit`** — 0 new type errors from modified files (all 4 pre-existing issues are unrelated)

---

## Summary

| Category | Count |
|----------|-------|
| Auth routes — already clean | 10 |
| Admin routes — fixed | 15 (across 14 files) |
| Admin routes — intentionally left (control flow only) | 11 |
| Admin routes — require manual analysis | 0 |
| **Total leaks eliminated** | **15** |
