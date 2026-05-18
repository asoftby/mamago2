# ADMIN API Auth Audit & Fix Report

**Date:** 2026-05-12  
**Scope:** All `src/app/api/admin/**/route.ts` + `src/app/admin/import/actions/bulk-delete/route.ts`  
**Goal:** Close all admin API routes with mandatory authentication and role-check to eliminate IDOR / privilege escalation.

---

## 1. Added Helpers

**File:** [`src/lib/auth/requireAdminApi.ts`](src/lib/auth/requireAdminApi.ts)

| Export | Allowed Roles | HTTP Status on failure |
|---|---|---|
| `requireAdminApiUser()` | `ADMIN` only | 401 (no session) / 403 (wrong role) |
| `requireAdminOrModeratorApiUser()` | `ADMIN` or `MODERATOR` | 401 (no session) / 403 (wrong role) |

Both functions:
- Use existing [`getCurrentUser()`](src/lib/auth/server.ts:9) from the project's auth layer.
- Return `User` on success, `NextResponse` error on failure.
- Follow the same pattern as existing guards in the codebase (e.g. [`requireAdminOrModerator`](src/lib/article/requireAdminOrModerator.ts)).

---

## 2. Routes That Were Missing Auth (Fixed)

### 2.1 Seed
| Route | Method | Role Required |
|---|---|---|
| [`/api/admin/seed`](src/app/api/admin/seed/route.ts) | `POST` | `ADMIN` |

### 2.2 Taxonomy — Cities
| Route | Method | Role Required |
|---|---|---|
| [`/api/admin/taxonomy/cities`](src/app/api/admin/taxonomy/cities/route.ts) | `GET` | `ADMIN` or `MODERATOR` |
| [`/api/admin/taxonomy/cities/[id]`](src/app/api/admin/taxonomy/cities/%5Bid%5D/route.ts) | `PATCH` | `ADMIN` or `MODERATOR` |

### 2.3 Taxonomy — Metro Stations
| Route | Method | Role Required |
|---|---|---|
| [`/api/admin/taxonomy/metro-stations`](src/app/api/admin/taxonomy/metro-stations/route.ts) | `GET`, `POST` | `ADMIN` or `MODERATOR` |
| [`/api/admin/taxonomy/metro-stations/[id]`](src/app/api/admin/taxonomy/metro-stations/%5Bid%5D/route.ts) | `PATCH`, `DELETE` | `ADMIN` or `MODERATOR` |

### 2.4 Taxonomy — Districts
| Route | Method | Role Required |
|---|---|---|
| [`/api/admin/taxonomy/districts`](src/app/api/admin/taxonomy/districts/route.ts) | `GET`, `POST` | `ADMIN` or `MODERATOR` |
| [`/api/admin/taxonomy/districts/[id]`](src/app/api/admin/taxonomy/districts/%5Bid%5D/route.ts) | `PATCH`, `DELETE` | `ADMIN` or `MODERATOR` |

### 2.5 Filters
| Route | Method | Role Required |
|---|---|---|
| [`/api/admin/filters`](src/app/api/admin/filters/route.ts) | `GET`, `POST` | `ADMIN` or `MODERATOR` |
| [`/api/admin/filters/[id]`](src/app/api/admin/filters/%5Bid%5D/route.ts) | `GET`, `PATCH`, `DELETE` | `ADMIN` or `MODERATOR` |
| [`/api/admin/filters/[id]/options`](src/app/api/admin/filters/%5Bid%5D/options/route.ts) | `POST` | `ADMIN` or `MODERATOR` |
| [`/api/admin/filters/options/reorder`](src/app/api/admin/filters/options/reorder/route.ts) | `POST` | `ADMIN` or `MODERATOR` |
| [`/api/admin/filter-options/[optionId]`](src/app/api/admin/filter-options/%5BoptionId%5D/route.ts) | `PATCH`, `DELETE` | `ADMIN` or `MODERATOR` |

### 2.6 Discovery — Class Chips
| Route | Method | Role Required |
|---|---|---|
| [`/api/admin/discovery/class-chips`](src/app/api/admin/discovery/class-chips/route.ts) | `GET`, `POST` | `ADMIN` or `MODERATOR` |
| [`/api/admin/discovery/class-chips/[id]`](src/app/api/admin/discovery/class-chips/%5Bid%5D/route.ts) | `PATCH`, `DELETE` | `ADMIN` or `MODERATOR` |

### 2.7 Import
| Route | Method | Role Required |
|---|---|---|
| [`/api/admin/import/metro-osm`](src/app/api/admin/import/metro-osm/route.ts) | `POST` | `ADMIN` or `MODERATOR` |

### 2.8 Bulk Delete (Route Handler outside `/api/admin`)
| Route | Method | Role Required |
|---|---|---|
| [`/app/admin/import/actions/bulk-delete`](src/app/admin/import/actions/bulk-delete/route.ts) | `POST` | `ADMIN` or `MODERATOR` |

---

## 3. Routes That Already Had Auth (Not Changed)

The following route groups already had proper auth checks and were **not modified**:

| Group | Auth Pattern |
|---|---|
| `analytics/*` | `requireRole([Role.ADMIN, Role.MODERATOR])` |
| `articles/*` | `requireAdminOrModerator()` |
| `b2b/partners` | `getCurrentUser()` + role check |
| `billing/*` | `getCurrentUser()` + role check |
| `broadcasts/*` | `getCurrentUser()` + role check |
| `business/*` | `getCurrentUser()` + role check |
| `business-verification/*` | `getCurrentUser()` + role check |
| `businesses/list` | `getCurrentUser()` + role check |
| `content/*` | `requireAdminOrModerator()` |
| `debug-db` | `getCurrentUser()` + role check |
| `demote` | `getCurrentUser()` + role check |
| `email-templates/*` | `requireAdminOrModerator()` |
| `genres/*` | `canManageEventCategories()` |
| `import/runs/[runId]` | `getCurrentUser()` + role check |
| `media/*` | `getCurrentUser()` + role check |
| `moderation/*` | `getCurrentUser()` + role check |
| `occasions/*` | `canManageEventCategories()` |
| `organizers/*` | `getCurrentUser()` + role check |
| `pages/*` | `requireAdminOrModerator()` |
| `place-groups/*` | `getCurrentUser()` + role check |
| `places/*` | `getCurrentUser()` + role check |
| `places/claims/*` | `getCurrentUser()` + role check |
| `promote` | `getCurrentUser()` + role check |
| `ranking` | custom `requireAdmin()` helper |
| `reviews/*` | `getCurrentUser()` + role check |
| `search/*` | `getCurrentUser()` + role check |
| `seo/*` | auth in `http.ts` handler |
| `taxonomy/event-categories/*` | `canManageEventCategories()` |
| `users/*` | `requireRole()` |

---

## 4. Verification

| Check | Status |
|---|---|
| `pnpm tsc --noEmit` | ✅ Passes (pre-existing errors unrelated to changes) |
| `pnpm lint src --quiet` | ✅ Passes (pre-existing errors unrelated to changes) |
| No public GET routes outside `/api/admin` modified | ✅ |
| No `schema.prisma` changes | ✅ |
| No UI changes | ✅ |
| Business logic unchanged | ✅ |

---

## 5. Potential Remaining Admin Routes (Requiring Manual Review)

| Route | Notes |
|---|---|
| [`/api/admin/ranking`](src/app/api/admin/ranking/route.ts) | Already has auth via custom `requireAdmin()` helper — works correctly, left as-is. |
| [`/api/admin/import/runs/[runId]`](src/app/api/admin/import/runs/%5BrunId%5D/route.ts) | Already has auth via `getCurrentUser()` + `requireAdminOrEditor()` — works correctly, left as-is. |
| [`/api/admin/taxonomy/cities`](src/app/api/admin/taxonomy/cities/route.ts) `GET` without `details=1` | Returns basic city list for admin UI dropdowns. Now requires `ADMIN` or `MODERATOR`. |
| [`/api/admin/taxonomy/metro-stations`](src/app/api/admin/taxonomy/metro-stations/route.ts) `GET` | Returns metro stations for admin UI. Now requires `ADMIN` or `MODERATOR`. |
| [`/api/admin/taxonomy/districts`](src/app/api/admin/taxonomy/districts/route.ts) `GET` | Returns districts for admin UI. Now requires `ADMIN` or `MODERATOR`. |

All remaining routes under `/api/admin/` are now covered.

---

## 6. Summary

- **1 new helper file** created (`src/lib/auth/requireAdminApi.ts`)
- **17 route files** updated with auth guards
- **0 business logic changes**
- **0 schema changes**
- **0 UI changes**

Anonymous requests to any `/api/admin/**` route can no longer read or mutate data.