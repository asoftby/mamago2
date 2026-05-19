# Phase 6H: Public Page Request Audit

**Date:** 2026-05-19
**Files changed:**
- `src/features/city-home/pages/CityHomePage.tsx` (console.log removed)

**Preceded by:** Phase 6G-1 (`docs/audits/import-table-indexes.md`)

---

## Scope

Audit every API/fetch call triggered on the public city homepage (`/[city]`) for guest and
authenticated users on initial load. Check for: unnecessary guest auth requests, notification
leaks, duplicate header fetches, eager geo or weather calls.

Pages covered: public layout (`/(public)/layout.tsx`), city homepage (`CityHomePage.tsx`),
both desktop and mobile `SiteHeader` instances.

---

## Request inventory (initial load)

### Guest user

| # | Endpoint | Trigger | Caching |
|---|----------|---------|---------|
| 1 | `/api/public/cities` | `usePublicCityOptions` on first mount | Module-level cache — fires once per page session regardless of remounts |
| 2 | `/api/weather/weekly?city=<slug>` | `WeatherProvider` → `useEffect` | Module-level `weatherCache` per slug; `Cache-Control: public, max-age=1800` |

**Total for guest: 2 client-side requests.**

Auth and notification endpoints are not called for guests.

### Authenticated user (in addition to the 2 above)

| # | Endpoint | Trigger | Guard |
|---|----------|---------|-------|
| 3 | `/api/children` | `FamilyPersonaContext` | `if (status !== "authenticated") return` |
| 4 | `/api/notifications/unread-count` | `NotificationStoreAuthSync` | `if (!authed \|\| unreadStream === "none") return` |

**Total for authenticated: 4 client-side requests.**

---

## Known concerns — result

### Auth request on guest load

**Non-issue.** `AuthProvider` (`src/lib/auth/AuthProvider.tsx`) initializes from the
server-provided `initialUser` prop passed down from the root layout. There is no `fetch`
on mount — the client only re-fetches on an `AUTH_STATE_CHANGED_EVENT` (e.g. after
login/logout). Guests never trigger `/api/auth/me`.

### Notification fetch on guest load

**Non-issue.** `NotificationStoreAuthSync` guards with `if (!authed || unreadStream === "none")
return` before any network call. `NotificationSurfaceBootstrap` guards with
`if (unreadStream === "none") return null` before rendering. Both checks run before any
fetch, so guests generate zero notification requests.

### Duplicate header fetches

**Non-issue.** Both desktop and mobile `SiteHeader` components are always in the DOM
(controlled by CSS: `hidden lg:contents` / `contents lg:hidden`), so hooks in both can run.
However:
- `usePublicCityOptions` uses a module-level `cachedCities` variable — only the first call
  fetches; the second returns the cached array immediately.
- `HeaderDiscoveryFiltersProviderWrapper` wraps both headers with a single shared provider,
  so geo state is not duplicated.

### Double WeatherProvider mount

**Non-issue.** `OptionalWeatherProvider` (`src/components/providers/OptionalWeatherProvider.tsx`)
checks for an existing `WeatherContext` before mounting another `WeatherProvider`. Nested
trees cannot create a second fetch.

### Geo provider eager call

**Non-issue.** `loadGeoFilters` in `headerDiscoveryFiltersContext.tsx` is only triggered on
user interaction (filter panel open), not on mount.

---

## Findings

### F1 — Unconditional `console.log` in `CityHomePage` · LOW (fixed)

**File:** `src/features/city-home/pages/CityHomePage.tsx`, lines 96–101 (pre-fix)

```ts
console.log("[API] real data used", {
  endpoint: "city-home-routes",
  city: city.slug,
  localCount: localRouteItems.length,
  nearbyCount: nearbyRouteItems.length,
});
```

This ran unconditionally on every SSR render of the city homepage in all environments
including production. It is a leftover debugging statement — not behind `process.env.NODE_ENV`
or any feature flag. **Removed.**

### F2 — `GlobalProviders` dead code · INFO (not fixed in this phase)

**File:** `src/components/providers/GlobalProviders.tsx`

The component is exported but never imported anywhere in the codebase. It was likely
superseded by `PublicProviders`. No runtime impact — tree-shaken out of the bundle.
Left for a future cleanup pass.

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| Auth fetch architecture | Already correct — server `initialUser`, event-driven refetch |
| Notification guards | Already correct — `unreadStream` check before any fetch |
| `usePublicCityOptions` module cache | Working correctly; no double fetch |
| `OptionalWeatherProvider` | Correctly prevents nested double-mount |
| Weather API `revalidate: 1800` | Appropriate for hourly forecast data |
| `GlobalProviders.tsx` dead code | No runtime impact; out of scope |

---

## Architecture summary

The public page request architecture is clean. Providers use auth-state guards, module-level
caches, and context-presence checks to ensure each network call fires at most once per page
session and never for guests when the data isn't needed.
