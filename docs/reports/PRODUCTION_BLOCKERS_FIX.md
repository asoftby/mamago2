# PRODUCTION_BLOCKERS_FIX

Date: 2026-05-13
Repo: `/Users/shapovalovalexey/dev/mamago2`
Branch: `feature/offers-discovery-signals`

## Scope

Fixed only the requested production blockers with small, local changes.
Did not touch Prisma schema.
Did not refactor notification architecture.

## Changes Made

### 1. Closed public `/api/search/debug`

File:
- `src/app/api/search/debug/route.ts`

Change:
- Added `requireAdminOrModeratorApiUser()`.
- In production, unauthorized/non-admin access now returns `404`.
- In non-production, the existing auth response is preserved for diagnostics.

Impact:
- Unpublished `SearchDocument` rows are no longer exposed publicly in production.

### 2. Checked `dev.db` git tracking

Check:
- `git ls-files | grep -E "^dev\\.db|^dev\\.db-journal"`

Result:
- No tracked `dev.db` or `dev.db-journal` files were found.

Change:
- Added missing root-anchored ignore rules to `.gitignore`:
  - `/dev.db`
  - `/dev.db-journal`

Existing ignore rules already covered:
- `dev.db`
- `dev.db-journal`

### 3. Removed debug/auth pages

Files removed:
- `src/app/auth-test/page.tsx`
- `src/app/debug-mobile-search/page.tsx`

Reason:
- Both pages were clearly debug-only and exposed internal/diagnostic behavior.
- Deletion is safer than leaving them reachable in production.

### 4. Added rate-limit to public bookings

File:
- `src/app/api/public/bookings/route.ts`

Change:
- Added early IP-based rate-limit using `src/lib/security/rateLimit.ts`
- Key: `booking_create:${ip}`
- Limit: `10 requests / 10 minutes`
- Response on limit:
  - `429 { "error": "Too many requests" }`

Placement:
- Before auth lookup
- Before DB reads
- Before booking creation

### 5. Hardened analytics `meta`

File:
- `src/app/api/analytics/events/route.ts`

Change:
- Replaced `meta: z.any()` with safe object-or-null validation.
- `meta` must now be:
  - JSON object, or
  - `null`, or
  - omitted
- Added payload guard:
  - `JSON.stringify(meta).length <= 4096`
- Invalid payload returns generic:
  - `400 { "error": "invalid_payload" }`

Impact:
- Prevents arbitrary oversized/unstructured analytics blobs.

## Files Changed

- `.gitignore`
- `src/app/api/search/debug/route.ts`
- `src/app/api/public/bookings/route.ts`
- `src/app/api/analytics/events/route.ts`
- `src/app/auth-test/page.tsx` deleted
- `src/app/debug-mobile-search/page.tsx` deleted

## Verification Notes

Manual checks completed:
- confirmed repo path, branch, and dirty worktree before edits
- confirmed `dev.db` was not tracked
- confirmed debug pages existed and were removed

Automated verification status:
- `pnpm exec tsc --noEmit` is currently blocked by pre-existing unrelated repository errors:
  - `next.config.ts`
  - `src/features/discovery/signals/utils.ts`
  - `src/lib/settings/resolveSettingsContext.ts`

These blockers predate this patch set and are not caused by the changes above.

## Residual Risk

- Public bookings rate-limit is in-memory only. It is acceptable for MVP/single-instance, but not ideal for horizontally scaled production.
- `/api/notifications/telegram/test` still exists and is authenticated-user reachable; not part of this patch, but worth reviewing separately.
