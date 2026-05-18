# Performance Optimization Checkpoint — mamaGo 2.0

Date: 2026-05-19  
Scope: runtime performance, public providers, header fetches, weather, notifications, geo API cache, event save flow

## Status

Performance optimization work is being done in small, safe phases.  
The goal is to improve perceived speed and reduce unnecessary runtime/server work without risky rewrites or broken publication consistency.

## Completed phases

### Phase 1 — Public provider deduplication

Status: completed and pushed.

What changed:
- Removed duplicated provider mounting between root/public layouts.
- Public-specific providers now mount only once on the public surface.
- Reduced duplicate effects/context trees for:
  - `CityProvider`
  - `WeatherProvider`
  - `FamilyPersonaProvider`
  - `MyPlanProvider`
  - related public-only sync layers

Result:
- Cleaner public runtime tree.
- Lower risk of duplicate `/api/children`, city/weather/family effects.

Related report:
- `docs/audits/provider-deduplication-fix.md`
- `docs/audits/runtime-network-audit.md`

---

### Phase 2 — Lazy-load header geo filters

Status: completed and pushed.

What changed:
- Header geo filter data is no longer fetched on public page mount.
- `/api/geo/districts` and `/api/geo/metro-stations` now load only when search/filter UI is opened.
- Added/reused client cache and in-flight dedupe by `citySlug`.

Result:
- Public page load no longer eagerly fetches geo filter reference data.
- Desktop/mobile header still share the same data path.

Related report:
- `docs/audits/header-geo-lazy-fetch-fix.md`

---

### Phase 3 — Scope WeatherProvider to weather-aware UI

Status: completed and pushed.

What changed:
- Removed global `WeatherProvider` from the general public provider stack.
- Added local/optional weather provider near actual weather consumers.
- Added response cache headers for `/api/weather/weekly`.

Result:
- Pages without weather UI no longer trigger `/api/weather/weekly`.
- Weather remains available where it is actually rendered.

Related report:
- `docs/audits/weather-provider-scope-fix.md`

---

### Phase 4 — Gate notification unread bootstrap

Status: completed and pushed.

What changed:
- Unread notification bootstrap is no longer global/auth-only.
- Added surface-aware bootstrap for real visible badge surfaces:
  - public shell
  - business shell
  - admin layout
- Preserved throttling and in-flight dedupe in notification store.

Result:
- `/api/notifications/unread-count` no longer starts just because a user is authenticated.
- Full notification feed still loads lazily when the panel/page is opened.

Related report:
- `docs/audits/notification-unread-bootstrap-fix.md`

---

### Phase 5 — Cache geo city resolver

Status: completed and pushed.

What changed:
- Added shared cached `citySlug -> cityId` resolver.
- Reused it in:
  - `/api/geo/districts`
  - `/api/geo/metro-stations`
- Cache strategy: `unstable_cache` with per-slug key and 1h revalidate.

Result:
- When geo endpoints are requested together, repeated city lookup work is reduced.
- Response shape and query params stayed unchanged.

Related report:
- `docs/audits/geo-city-resolver-cache-fix.md`

---

### Phase 6A — Save-flow revalidation/refresh audit

Status: completed and documented.

What changed:
- No code changes.
- Audited save/edit/submit/moderation flows for:
  - events
  - offers
  - places
  - routes

Main finding:
- The main save-flow bottleneck is not client `router.refresh`.
- The hottest path is business event PATCH, especially draft saves with schedule/gallery/occurrence/revalidation side effects.

Related report:
- `docs/audits/save-flows-revalidate-refresh-audit.md`

---

### Phase 6B — Gate event PATCH debug reads

Status: completed and pushed.

What changed:
- Gated `getActivityOccurrenceDebugState()` calls behind `isServerSavePerfEnabled()`.
- Gated event PATCH timing/debug logs behind the same performance flag.

Result:
- Normal event draft PATCH no longer performs unnecessary debug DB reads in production.
- Schedule-changing PATCH also avoids extra debug reads unless perf debugging is explicitly enabled.

Related report:
- `docs/audits/event-patch-hot-path-fix.md`

---

### Phase 6C — Narrow event business-save revalidation

Status: completed and pushed.

What changed:
- Business event PATCH now skips `/business/events` and `/business/publications/events` revalidation only when the save is proven editor-only.
- Added fail-safe allowlist:
  - unknown fields trigger revalidation
  - list-visible fields trigger revalidation
  - non-`business-save` scopes always revalidate

Result:
- Editor-only draft saves avoid unnecessary business-list invalidation.
- Publish/moderation/slug/city/status/visibility consistency remains protected.

Related report:
- `docs/audits/event-business-save-revalidation-fix.md`

---

## Current checkpoint summary

Completed optimizations reduced unnecessary work in three major areas:

1. Public runtime mount cost
   - fewer global providers
   - fewer eager fetches
   - scoped weather/geo/notification fetches

2. Backend reference data cost
   - cached geo city resolver
   - lazy geo loading

3. Event draft save cost
   - debug DB reads removed from normal hot path
   - editor-only draft saves avoid business-list revalidation

## Verification baseline

Across phases, the following checks were run repeatedly:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm build`

Known note:
- `pnpm lint` still reports many pre-existing warnings, but no new blocking errors were introduced during these phases.
- Several `next build` hangs were caused by stale/zombie `next build` processes or `.next` locks; after cleanup, production builds completed.

## Remaining planned phases

### Phase 6D — Optimize sync guards

Potential scope:
- event schedule/session sync guards
- event gallery sync guards
- place subcategory diff guard

Goal:
- avoid `deleteMany + createMany` when payload is unchanged.

### Phase 6E — Route save flow

Potential scope:
- add route stop fingerprint
- skip full stop replacement when stops are unchanged

Goal:
- reduce DB rewrites in route editor saves.

### Phase 6F — Place revision / moderation heavy paths

Potential scope:
- published-place revisions
- revision images
- opening-hours copy
- approval path

Goal:
- keep strong consistency while reducing heavy replace-all operations.

### Later — Admin/business counters

Potential scope:
- admin shell counters
- moderation counts
- import/review pending badges
- business dashboard counters

Goal:
- defer or lazy-load expensive counters instead of blocking shell/navigation.

### Later — Security dependencies audit

GitHub reports dependency vulnerabilities on default branch.

Goal:
- handle separately after performance phases.
- do not run broad `pnpm update`.
- patch high/runtime vulnerabilities first.
- document remaining risk.

## Safety rules going forward

Do not blindly remove:
- publish revalidation
- moderation revalidation
- slug/city/visibility consistency logic
- submit-time validation
- public canonical path revalidation

Prefer:
- small PRs
- fail-safe guards
- audit before risky code changes
- build after every phase
