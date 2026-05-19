# Phase 6J: Release Readiness Sanity Audit

**Date:** 2026-05-19
**Files changed:**
- `src/app/(public)/routes/page.tsx` — console.log removed
- `src/server/services/userBirthdays.service.ts` — console.log removed

**Preceded by:** Phase 6H (`docs/audits/public-page-request-audit.md`)

---

## 1. Package scripts and validation commands

| Command | Purpose | Result |
|---------|---------|--------|
| `pnpm lint` | ESLint across all source | 0 errors, 514 warnings (pre-existing) |
| `pnpm exec tsc --noEmit` | Full TypeScript check | CLEAN |
| `pnpm build` | Next.js production build | CLEAN |
| `pnpm exec prisma validate` | Schema validation | Valid |
| `pnpm exec prisma migrate status` | Migration sync | 166 migrations, DB up to date |

Notable scripts available but not part of CI: `pnpm check` (tsc + eslint + build combined),
`pnpm test:unit`, `pnpm test:notifications-mvp`, `pnpm test:anti-repeat`,
`pnpm test:weather-provider`.

---

## 2. TypeScript / build / lint status

**TypeScript:** Clean — zero errors.

**ESLint:** 514 warnings, 0 errors. All warnings are pre-existing `@typescript-eslint/no-unused-vars`
and `react-hooks/exhaustive-deps` — none are new. No errors.

**Build:** Passes cleanly. All public and admin routes compile without issue.

---

## 3. Prisma schema / migration status

- Schema valid (`prisma validate` passes).
- Local database is up to date with all 166 migrations.
- Migrations from Phase 6G-1 (`20260519120000_add_imported_record_review_indexes`) are present
  and included in the count.
- Deprecation note: `package.json#prisma` config key is deprecated in favor of `prisma.config.ts`
  (Prisma 7 prep). Non-blocking — Prisma 6 still honors it.

---

## 4. Public pages

### City homepage (`/[city]`)
- Delegates to `CityHomePage` server component.
- Phase 6H confirmed: 2 client requests for guests, 4 for authenticated users.
- No `console.log` remaining after Phase 6H fix.
- Loads route/activity data via service layer with `catch(() => [])` fallbacks.

### Event detail (`/[city]/events/[slugOrId]`)
- Uses `loadPublicActivityForCityPage` with `ContentStatus` guard.
- `getCurrentUser()` called for edit-link visibility only — not a gate.
- `notFound()` on missing slug; `permanentRedirect` on legacy ID paths.
- No console.log. Clean.

### Place detail (`/places/[slug]` and `/[city]/places/[slug]`)
- `isPlacePubliclyVisible()` guard + `status !== "PUBLISHED" → notFound()`.
- `getCurrentUser()` called for edit-link visibility only.
- No console.log. Clean.

### Offer/classes detail (`/offers/[slug]`)
- `notFound()` on missing slug with legacy-ID redirect.
- No console.log. Clean.

### Offers/classes listing (stub)
- `offerPageDataTransformer.ts` has multiple `TODO` comments for future fields
  (`videoUrl`, `reviews`, `similar`, `offerWizardType`, `scheduleJson`).
  These return empty/undefined — the page renders without errors. Not blocking.

### Routes listing (`/routes`)
- **Fixed (F1):** Removed `console.log("[API] real data used", ...)` that fired on every SSR.
- Route detail (`/routes/[slug]`) has no console.log.

### Programs page (`/[city]/programs`)
- One `TODO` comment: "Add city filter when cityId is properly set on activities".
  Data still loads; just shows non-city-filtered results. Not blocking.

---

## 5. Auth / guest behavior

### Guest public pages do not spam 401s
- **Confirmed clean.** `AuthProvider` initializes from server-passed `initialUser` — no
  client `fetch` on mount for guests (see Phase 6H audit).
- `NotificationStoreAuthSync` and `NotificationSurfaceBootstrap` both guard on auth state
  before any network call.
- `FamilyPersonaContext` guards on `status !== "authenticated"`.
- Public API routes (`/api/public/cities`, `/api/weather/weekly`) require no auth.

### Authenticated-only requests are gated
- `/api/children/[id]` — `getCurrentUser()` called; returns 401 on no session.
- `/api/notifications/unread-count` — auth guard in place.
- Business and admin API routes require auth via layout redirects and API-level guards.

---

## 6. Admin / business basics

### Admin import pages
- Review page (`/admin/import/review`): Phase 6G fix confirmed — `getQueueStats` uses
  5 parallel `count` queries. `reconcileImportedRecordLinks` only called from
  `getImportedObjects` (bounded at `take: 100`).
- Runs page (`/admin/import/runs`): Phase 6G fix confirmed — `getRunRecordCounts` uses
  `groupBy` instead of loading all records.
- Admin layout requires `role === "ADMIN" || role === "MODERATOR"` — redirects otherwise.

### Place approval path
- Phase 6F confirmed: `mapToCreatePayload` is a static import in `placeRevision.service.ts`
  (line 11). No dynamic import inside the transaction.
- `isPlacePubliclyVisible` guard on public place pages prevents draft/archived leaks.

### Business publication flow
- Business `(protected)` layout guards: auth check → `getMyBusiness` → verification
  status check — redirects at each gate.
- `ADMIN`/`MODERATOR` users can have business access via `BusinessMember` — explicitly
  handled (not blocked by role check).

---

## 7. Console.log audit

### Fixed in this phase

| File | Line | Description |
|------|------|-------------|
| `src/app/(public)/routes/page.tsx` | 17 | `[API] real data used` — fired on every SSR of public routes page |
| `src/server/services/userBirthdays.service.ts` | 5 | `[API] real data used` — fired in stub service on every birthday list call |

(Combined with `CityHomePage.tsx` fix from Phase 6H — 3 public SSR console.logs total removed.)

### Remaining — non-blocking

| Location | Count | Disposition |
|----------|-------|-------------|
| `src/app/admin/**` (SSR pages) | ~7 | Admin-only SSR; not user-visible on public pages |
| `src/app/admin/users/UsersListClient.tsx` | 5 | Client-side, admin-only UI debugging |
| `src/app/api/children/[id]/route.ts` | ~41 | Authenticated API; leaks child update trace to server logs. Follow-up cleanup. |
| `src/app/api/ai/**` | ~5 | Internal AI API; server logs only |
| `src/app/api/bot/webhook/**` | ~2 | Telegram webhook; server logs only |
| `src/app/api/admin/**` | ~10 | Admin API; server logs only |
| `src/lib/media/imageProcessor.ts` | ~12 | Operational image processing trace |
| `src/lib/slug/placeSlugService.ts` | ~7 | Operational slug assignment trace |
| `src/lib/google-places/client.ts` | ~4 | External API call trace |
| `src/lib/sms/**` | ~4 | SMS send trace (redacted phone prefix) |
| `src/server/services/placeRevision.service.ts` | ~8 | Place revision workflow trace |
| `src/server/services/telegram/**` | ~10 | Telegram link service trace |
| `src/server/services/media/media.service.ts` | ~3 | Media commit/cleanup trace |
| `src/features/birthday/builder/...StepConfirmation.tsx` | 1 | Client-side; fires on birthday submit (non-SSR) |
| `src/features/hero-weather/**` | n/a | All via `weatherDiagLog` — guarded by `WEATHER_DEBUG=true` env ✓ |
| `src/lib/auth/examples/**` | ~10 | Example files, not in production paths |

The server-side logs in services (`placeRevision`, `slug`, `media`, `telegram`, `sms`) are
operational traces that are acceptable at this stage. They do not expose sensitive data in
excess and do not spam on read paths. Recommend a cleanup pass before high-traffic production.

---

## 8. Summary: release-blocking vs follow-up

### Release-blocking (fixed in this phase)
- ✅ `routes/page.tsx` — unconditional SSR `console.log` (removed)
- ✅ `userBirthdays.service.ts` — unconditional stub `console.log` (removed)
- ✅ (Phase 6H) `CityHomePage.tsx` — unconditional SSR `console.log` (removed)

### No issues found (confirmed clean)
- TypeScript — zero errors
- Build — clean
- Prisma schema — valid, migrations current
- Public page visibility gates — all in place
- Guest auth/notification behavior — no 401 spam, all gated
- Admin auth guards — ADMIN/MODERATOR role check + redirect
- Business auth guards — multi-step: auth → business → verification
- Phase 6F (place approval static import) — confirmed
- Phase 6G (admin import performance) — confirmed

### Follow-up (non-blocking)

| Issue | Priority | Notes |
|-------|----------|-------|
| `/api/children/[id]/route.ts` — 41 console.logs | MEDIUM | Server logs, authenticated only; leaks update trace on every child PUT/DELETE |
| `admin/users/UsersListClient.tsx` — 5 console.logs | LOW | Admin client-side only |
| Offer page `TODO` stubs | LOW | Returns empty arrays — no error, page renders |
| Service-layer operational traces (`placeRevision`, `slug`, `media`, `telegram`, `sms`) | LOW | Acceptable for current stage; clean before high-traffic prod |
| `GlobalProviders.tsx` dead code | LOW | Never imported; tree-shaken; no runtime impact |
| Prisma `package.json#prisma` deprecation | LOW | Prisma 7 prep; non-breaking today |
| ESLint 514 warnings | INFO | All pre-existing `no-unused-vars` / `react-hooks/exhaustive-deps` |
