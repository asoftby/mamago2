# Admin Pagination Limit Fix

## Problem

Several admin API routes parsed the `limit` query parameter directly from `searchParams` using `parseInt()` without clamping the value via `Math.min()`. This allowed requests like `?limit=999999` to extract excessive amounts of data (users, reviews, transactions, etc.), posing a performance and data exposure risk.

## Solution

Applied the existing [`parsePaginationParams()`](src/lib/api/pagination.ts) helper to all admin list/pagination routes. The helper safely clamps `limit` to a configurable range:

| Parameter    | Default | Description                        |
|-------------|---------|------------------------------------|
| `minLimit`  | `1`     | Minimum allowed limit              |
| `maxLimit`  | `100`   | Maximum allowed limit              |
| `defaultLimit` | `20` | Default when not specified         |

It also computes `page` (min 1) and `skip = (page - 1) * limit`.

## Files Changed

### Routes already using `parsePaginationParams` (no change needed)

- [`src/app/api/admin/users/route.ts`](../../src/app/api/admin/users/route.ts) — already safe
- [`src/app/api/admin/media/route.ts`](../../src/app/api/admin/media/route.ts) — already safe

### Routes fixed to use `parsePaginationParams`

| Route | Previous limit parsing | New behavior | Stricter maxLimit preserved? |
|-------|----------------------|-------------|------------------------------|
| [`src/app/api/admin/reviews/moderation/route.ts`](../../src/app/api/admin/reviews/moderation/route.ts) | Used `parsePaginationParams` but destructured `skip` while using `offset` (undefined bug) | Fixed: `skip` aliased as `offset` for backward compat | N/A (was already using helper) |
| [`src/app/api/admin/reviews/places/route.ts`](../../src/app/api/admin/reviews/places/route.ts) | Same bug as above | Same fix | N/A |
| [`src/app/api/admin/billing/businesses/[businessId]/transactions/route.ts`](../../src/app/api/admin/billing/businesses/%5BbusinessId%5D/transactions/route.ts) | `parseInt(searchParams.get("limit") \|\| "50")` — no clamp | `parsePaginationParams(searchParams, { defaultLimit: 50 })` | N/A |
| [`src/app/api/admin/search/index/route.ts`](../../src/app/api/admin/search/index/route.ts) | `parseInt(searchParams.get("limit") \|\| "50")` — no clamp | `parsePaginationParams(searchParams, { defaultLimit: 50 })` | N/A |
| [`src/app/api/admin/search/zero-results/route.ts`](../../src/app/api/admin/search/zero-results/route.ts) | `parseInt(searchParams.get("limit") \|\| "100")` — no clamp | `parsePaginationParams(searchParams, { defaultLimit: 100 })` | N/A |
| [`src/app/api/admin/articles/media-picker/route.ts`](../../src/app/api/admin/articles/media-picker/route.ts) | `Math.min(60, Math.max(1, parseInt(...)))` — inline | `parsePaginationParams(searchParams, { defaultLimit: 36, maxLimit: 60 })` | ✅ `maxLimit: 60` preserved |
| [`src/app/api/admin/b2b/partners/route.ts`](../../src/app/api/admin/b2b/partners/route.ts) | `Math.max(1, Math.min(30, Number(...)))` — inline | `parsePaginationParams(searchParams, { defaultLimit: 10, maxLimit: 30 })` | ✅ `maxLimit: 30` preserved |
| [`src/app/api/admin/organizers/route.ts`](../../src/app/api/admin/organizers/route.ts) | `Math.max(1, Math.min(30, Number(...)))` — inline | `parsePaginationParams(searchParams, { defaultLimit: 10, maxLimit: 30 })` | ✅ `maxLimit: 30` preserved |

## Bug Fix: Undefined `offset` in Reviews Routes

The reviews routes at [`reviews/moderation/route.ts`](../../src/app/api/admin/reviews/moderation/route.ts) and [`reviews/places/route.ts`](../../src/app/api/admin/reviews/places/route.ts) already imported and called `parsePaginationParams`, but destructured `{ limit, skip }` while the Prisma query and response used `offset`. This meant `offset` was always `undefined`, causing:

- **Prisma query**: `skip: undefined` — effectively no pagination offset (always page 1)
- **Response**: `offset: undefined` — misleading pagination metadata

Fixed by aliasing: `const { limit, skip: offset } = parsePaginationParams(...)`.

## Verification

- [x] `pnpm typecheck` — passes
- [x] `pnpm lint` — passes
- [x] All existing routes preserve their response format
- [x] Routes with stricter `maxLimit` (e.g., 30, 60) retain their custom limits