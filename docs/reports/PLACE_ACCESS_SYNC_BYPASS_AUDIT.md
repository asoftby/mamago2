# Place Access Sync-Bypass Audit

**Date:** 2026-05-13  
**Objective:** Audit all `canManagePlace()` call sites and eliminate sync-bypass risk

---

## Background

[`src/lib/auth/placeAccess.ts`](src/lib/auth/placeAccess.ts) exposes two functions for checking place authorization:

| Function | Type | Behavior |
|----------|------|----------|
| [`canManagePlace()`](src/lib/auth/placeAccess.ts:21) | **Sync** | Returns `true` when `place.ownerBusinessId` is set, **without verifying** that the user actually owns that business. Relies on the caller having already verified business ownership. |
| [`canManagePlaceAsync()`](src/lib/auth/placeAccess.ts:73) | **Async** | Performs a full database check via `canAccessBusiness()` to verify the user is a business owner or member. |

The sync version is dangerous because it trusts the caller to have already performed business ownership verification. If used in an API endpoint without prior verification, it creates an authorization bypass — any authenticated user can access any place that has an `ownerBusinessId`.

---

## Audit Results

### grep evidence

```
$ grep -rn "canManagePlace\b" src/ --include="*.ts" --include="*.tsx"
src/lib/auth/placeAccess.ts:21:export function canManagePlace(      ← definition only

$ grep -rn "canManagePlaceAsync" src/ --include="*.ts" --include="*.tsx"
src/app/api/business/places/[id]/contact-summary/route.ts  → await canManagePlaceAsync
src/app/api/business/places/[id]/submit/route.ts           → await canManagePlaceAsync
src/app/api/business/places/[id]/delete/route.ts           → await canManagePlaceAsync
src/app/api/business/places/[id]/images/[imageId]/route.ts → !canManagePlaceAsync     ← BUG: missing await
src/app/api/business/places/[id]/images/route.ts           → await canManagePlaceAsync
src/app/api/business/places/[id]/group/route.ts            → await canManagePlaceAsync
src/app/api/business/places/[id]/opening-hours/route.ts    → await canManagePlaceAsync
src/app/api/business/places/[id]/location/google/route.ts  → await canManagePlaceAsync
src/app/api/business/places/[id]/location/manual/route.ts  → await canManagePlaceAsync
src/app/api/business/places/[id]/improvement-requests/route.ts → await canManagePlaceAsync
src/app/api/business/places/[id]/geo/route.ts              → await canManagePlaceAsync
src/app/api/business/places/[id]/route.ts                  → await canManagePlaceAsync (3x)
src/app/api/business/places/[id]/revision/images/route.ts  → await canManagePlaceAsync (2x)
src/app/api/business/places/[id]/revision/opening-hours/route.ts → await canManagePlaceAsync
... (services, permissions, media — all use await)
```

### Summary

| Category | Count | Status |
|----------|-------|--------|
| `canManagePlace()` sync call sites | **0** | ✅ Not used anywhere |
| `canManagePlaceAsync()` with `await` | **~30** | ✅ Correctly used |
| `canManagePlaceAsync()` **without** `await` | **1** | ❌ **Bug found** |

---

## Bug Found: Missing `await` in Image Delete Route

**File:** [`src/app/api/business/places/[id]/images/[imageId]/route.ts`](src/app/api/business/places/[id]/images/[imageId]/route.ts:35)

**Before:**
```typescript
if (!place.ownerBusinessId || !canManagePlaceAsync(user, place)) {
```

**Problem:** `canManagePlaceAsync` returns a `Promise<boolean>`. Without `await`, the Promise object is always truthy, so `!Promise` is always `false`. This means:
- The condition is equivalent to `!place.ownerBusinessId || false`
- If `place.ownerBusinessId` is set, the check **always passes** regardless of user ownership
- Any authenticated user could delete images from any business-owned place

**Fix applied:**
```typescript
if (!place.ownerBusinessId || !(await canManagePlaceAsync(user, place))) {
```

**Severity:** High — authorization bypass for DELETE image endpoint.

---

## Changes Made

### 1. [`src/lib/auth/placeAccess.ts`](src/lib/auth/placeAccess.ts:21) — Deprecation notice

Added `@deprecated` JSDoc to `canManagePlace()`:
```typescript
/**
 * @deprecated Use canManagePlaceAsync for any server-side authorization.
 *             The sync version bypasses business member checks and must not
 *             be used for access control decisions on the server.
 */
```

### 2. [`src/app/api/business/places/[id]/images/[imageId]/route.ts`](src/app/api/business/places/[id]/images/[imageId]/route.ts:35) — Bug fix

Added missing `await` to the `canManagePlaceAsync()` call.

---

## Verification

- **`pnpm lint`** — no errors on changed files (1 pre-existing warning: unused `prisma` import in `placeAccess.ts`)
- **`npx tsc --noEmit`** — no new type errors

## Conclusion

The codebase is well-migrated to `canManagePlaceAsync` — **zero call sites** use the sync `canManagePlace()` for access control. One real bug (missing `await`) was found and fixed. The sync function is now marked `@deprecated` to prevent future misuse.
