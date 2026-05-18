# Runtime Network Audit

Date: 2026-05-18
Scope: static code audit of public runtime providers, header flows, and targeted API routes in `mamago2`
Method: code-path inspection only; no application code changes, no browser trace capture

## Executive summary

The public surface currently mounts too much global client runtime too early. The biggest issue is not one slow request, but a stack of mount-time effects that start before the user has interacted with search, notifications, or family filters.

The most important finding is provider duplication: public pages are wrapped by city/weather/family/cookie providers in both [src/app/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/layout.tsx) and [src/components/providers/PublicProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/PublicProviders.tsx). Module-level caches soften some duplicate requests, but this still creates extra effects, extra context trees, and in the authenticated case can trigger duplicate `/api/children` fetches because `FamilyPersonaProvider` has no shared in-flight cache.

The second biggest issue is the unread notification badge path. It is globally mounted through [src/components/providers/GlobalProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/GlobalProviders.tsx) and [src/features/notifications/NotificationStoreAuthSync.tsx](/Users/shapovalovalexey/dev/mamago2/src/features/notifications/NotificationStoreAuthSync.tsx), which means authenticated users can hit `/api/notifications/unread-count` on initial load before opening any panel. That endpoint is described as lightweight, but in practice it still resolves auth, Telegram link state, notification audience, accessible surfaces, and then runs a Prisma count.

The header geo chain is better than it could be: desktop and mobile header trees share one `HeaderDiscoveryFiltersProvider`, so the app avoids a simple double-fetch there. But the provider still eagerly fetches `/api/geo/districts` and `/api/geo/metro-stations` for the current city on every public page load, even when the user never opens search or filters.

The good news is that most improvements can be done in small, low-risk PRs. The first safe wins are narrowing where providers mount, making unread count cheaper, and deferring geo/weather fetches until pages that actually render those features.

## Endpoint audit

| Endpoint | Who calls it | When it fires | Needed on every page load? | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| `/api/notifications/unread-count` | `NotificationStoreAuthSync` via Zustand actions in [notification-store.ts](/Users/shapovalovalexey/dev/mamago2/src/features/notifications/store/notification-store.ts) | Initial authenticated hydration on public/business surfaces; again on visibility/auth events | No, only if a notification badge is visible or the surface needs unread state | High | Keep the badge API, but narrow when it mounts. First safe step: do not initialize unread fetch on surfaces without a visible badge. Second step: make the route cheaper by avoiding repeated audience/Telegram work if the result can be derived once per request path or cached briefly. |
| `/api/notifications` | `NotificationFeed` via `openPanel()` in [NotificationFeed.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/business/notifications/NotificationFeed.tsx) | First time the notifications panel/dropdown is opened; pagination on load more | No | Medium | Current lazy behavior is good. Leave it lazy. If optimizing later, split the unread count path from full feed payload even more aggressively. |
| `/api/public/cities` | `usePublicCityOptions()` in [usePublicCityOptions.ts](/Users/shapovalovalexey/dev/mamago2/src/lib/city/usePublicCityOptions.ts) via `CityProvider` | On client mount for non-`/me` and non-`/admin` paths | Not on every route; only where city switching is actually usable | Medium | Existing client cache and HTTP cache are good. Biggest win is reducing duplicate provider mounts and skipping on more surfaces such as business/editor paths. Server-side, consider wrapping selector assembly in `unstable_cache` because it is reference data. |
| `/api/geo/districts` | `fetchMetroDistrictFilterOptions()` in [geoFilterOptionsClient.ts](/Users/shapovalovalexey/dev/mamago2/src/features/filters/discovery/geoFilterOptionsClient.ts) | Public header provider mount for current city | No | High | Defer until a search/filter UI is opened or render it only on pages that actually expose discovery filters. Add server-side caching for slug-to-city resolution and/or full payload. |
| `/api/geo/metro-stations` | Same as above | Same as above | No | High | Same fix as districts. The current shared provider prevents desktop/mobile duplication, but the eager fetch still happens too early. |
| `/api/weather/weekly` | `WeatherProvider` in [WeatherContext.tsx](/Users/shapovalovalexey/dev/mamago2/src/contexts/WeatherContext.tsx) | On client mount for non-`/me` and non-`/admin` paths when city is known | No | Medium | If weather is only shown on a subset of public pages, move provider lower. Add response cache headers to match route-level `fetch(..., { next: { revalidate }})` semantics for browser/CDN reuse. |
| `/api/auth/me` | `AuthProvider.refetch()` in [AuthProvider.tsx](/Users/shapovalovalexey/dev/mamago2/src/lib/auth/AuthProvider.tsx) | Not on normal initial load; only after auth state change or explicit refetch | No | Low | Current SSR hydration via `getCurrentAuthState()` is good. No urgent change needed. |
| `/api/children` | `FamilyPersonaProvider` in [FamilyPersonaContext.tsx](/Users/shapovalovalexey/dev/mamago2/src/contexts/FamilyPersonaContext.tsx) | On authenticated client mount for non-`/me` and non-`/admin` paths; again on family events | No | High | This is the clearest duplicate-fetch risk because public pages mount two family persona providers and this route has no shared in-flight cache. First fix should be provider dedupe/narrowing. Then consider a lighter list payload for header/filter use. |

## Provider audit

| Provider | Where it is connected | Does it fetch on mount? | Can move lower? |
| --- | --- | --- | --- |
| `AuthProvider` | Root layout in [src/app/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/layout.tsx), and separately inside `GlobalProviders` for some trees | No client fetch on initial load; server preloads auth state | Keep high |
| `CityProvider` | Root layout and again in `PublicProviders` | Indirectly yes, via `usePublicCityOptions()` and `/api/public/cities` | Yes |
| `WeatherProvider` | Root layout and again in `PublicProviders` | Yes, `/api/weather/weekly` | Yes |
| `FamilyPersonaProvider` | Root layout and again in `PublicProviders` | Yes for authenticated users, `/api/children` | Yes |
| `UnreadNotificationCountProvider` | `PublicProviders` | No by itself; reads Zustand store | Keep only where badge consumers exist |
| `NotificationStoreAuthSync` | `GlobalProviders` | Yes for authenticated users, indirectly via notification store unread refresh | Yes, or at least gate by surface/header presence |
| `HeaderDiscoveryFiltersProvider` | Public layout wrapper above `SiteHeader` | Yes, `/api/geo/districts` + `/api/geo/metro-stations` | Yes |
| `PendingActionProvider` | Root layout and again in `PublicProviders` | No network seen in this audit | Probably yes, but lower priority |
| `CookieConsentProvider` | Root layout and again in `PublicProviders` | No network seen in this audit | Yes |
| `MyPlanProvider` | Root layout for public and again in public layout | Not fully audited here | Likely yes; worth separate audit |

## What actually fires for guests

For a guest opening a typical public page, the likely mount-time network path is:

1. `/api/public/cities` from `CityProvider`
2. `/api/weather/weekly?city=...` from `WeatherProvider`
3. `/api/geo/metro-stations?citySlug=...` from `HeaderDiscoveryFiltersProvider`
4. `/api/geo/districts?citySlug=...` from `HeaderDiscoveryFiltersProvider`

For guests, the good news is:

- `/api/auth/me` is not needed on initial load because auth state is server-hydrated.
- `/api/children` does not fire unless authenticated.
- `/api/notifications/unread-count` does not fire unless authenticated.
- `/api/notifications` stays lazy until the notification panel is opened.

The main guest-side waste is therefore eager city, weather, and geo reference data on pages that may not need all three immediately.

## Desktop/mobile header duplication

`SiteHeader` renders separate desktop and mobile trees in [src/components/site/header/SiteHeader.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/site/header/SiteHeader.tsx), but the code already places one shared `HeaderDiscoveryFiltersProvider` above them in [src/app/(public)/HeaderDiscoveryFiltersProviderWrapper.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/(public)/HeaderDiscoveryFiltersProviderWrapper.tsx).

That means:

- There is no obvious duplicate network request between desktop and mobile geo-filter consumers for the same city.
- There is still an eager geo fetch on public load even if neither desktop nor mobile search UI is opened.

So the duplication problem is not "desktop and mobile both fetch". The duplication problem is "the shared provider still fetches too early".

## Notification badge cost

The unread badge path is not cheap enough to be treated as free:

- [src/app/api/notifications/unread-count/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/notifications/unread-count/route.ts) does auth lookup
- It loads Telegram link state
- It resolves the notification audience user
- It computes accessible surfaces
- It runs `getUnreadCount()` against Prisma

This is far lighter than fetching the full feed, but still too heavy for a globally mounted "just the badge number" path if that path runs on every authenticated page visit.

## Cache opportunities

These are the lowest-risk caching opportunities visible in the current code:

1. `listPublicCitySelectorOptions()` behind `/api/public/cities`
   - The route already returns public cache headers.
   - Add `unstable_cache` or a module-level server cache around the selector assembly to reduce repeated DB work.

2. `citySlug -> cityId` resolution in `/api/geo/districts` and `/api/geo/metro-stations`
   - Both routes repeat the same `prisma.city.findUnique({ select: { id: true } })`.
   - A tiny server helper with module cache or `unstable_cache` would be a safe first step.

3. Full geo payloads per city
   - Districts and metro stations are reference data.
   - The routes already emit cache headers, but server-side caching would still reduce DB hits on cold SSR/API execution paths.

4. `/api/weather/weekly`
   - Upstream Open-Meteo fetch already uses `revalidate: 1800`.
   - Add explicit `Cache-Control` on the response if browser/CDN reuse is desirable.

5. Notification unread count
   - Be careful here. Do not add long-lived cross-user caching.
   - Safe option: only reduce frequency and mount scope first. If still needed, consider a very short per-user memoization within a request boundary or event-driven invalidation, not a broad shared cache.

## Providers that should move lower

Best candidates to move below the public root:

1. `HeaderDiscoveryFiltersProvider`
   - Mount only on pages that actually render discovery search/filter controls.
   - Or mount lazily when search opens.

2. `WeatherProvider`
   - Move below pages/components that actually display weather-aware UX.

3. `FamilyPersonaProvider`
   - Keep off routes where "for whom" personalization is not rendered.
   - This is especially valuable because it triggers authenticated `/api/children`.

4. `UnreadNotificationCountProvider` plus `NotificationStoreAuthSync`
   - Keep where header/account UI actually renders a badge.
   - If some surfaces do not show notifications, do not initialize unread fetch there.

5. `CityProvider`
   - Harder to move because city is structural, but still worth narrowing away from surfaces where the city switcher is not used.

## Findings by severity

### Critical

- Public pages mount duplicate provider stacks from both root layout and `PublicProviders`, including `CityProvider`, `WeatherProvider`, and `FamilyPersonaProvider`.
- `FamilyPersonaProvider` has no shared in-flight request dedupe, so authenticated public pages can issue duplicate `/api/children` requests.

### High

- `NotificationStoreAuthSync` globally triggers unread notification fetches for authenticated users before the notifications UI is opened.
- `/api/notifications/unread-count` is marketed as lightweight but still runs non-trivial auth/audience/Telegram logic.
- `HeaderDiscoveryFiltersProvider` eagerly fetches geo reference data on public load even when search/filter UI stays closed.
- City/weather/family skip logic ignores `/business`, so root-mounted providers may still do unnecessary work on business/editor-like surfaces.

### Medium

- `/api/weather/weekly` has server fetch revalidation but no explicit response cache headers.
- `/api/public/cities` is reference data and already has HTTP cache headers, but server-side DB work can still be memoized.
- Geo endpoints each resolve `citySlug -> cityId` separately, doubling a small DB lookup on every cold geo load.

### Low

- `UnreadNotificationCountProvider` itself is cheap; the problem is where it sits relative to store sync and badge consumers.
- `/api/auth/me` is not an initial-load problem in the current architecture.
- Full notifications feed loading is already correctly lazy-on-open.

## PR-sized fix plan

### Phase 1: safest wins

1. Remove duplicate provider mounting between root layout and public layout.
2. Keep exactly one `FamilyPersonaProvider`, one `CityProvider`, and one `WeatherProvider` for public pages.
3. Gate `NotificationStoreAuthSync` so unread fetch is initialized only where a visible badge exists.
4. Add a tiny shared helper/cache for `citySlug -> cityId` used by geo endpoints.

### Phase 2: reduce eager public-load fetches

1. Move `HeaderDiscoveryFiltersProvider` lower or lazy-mount it on search/filter open.
2. Move `WeatherProvider` below routes that actually display weather data.
3. Review whether `FamilyPersonaProvider` can be mounted only for discovery/search/personalized surfaces.

### Phase 3: make surviving endpoints cheaper

1. Add server-side memoization for public city selector data.
2. Add response cache headers to `/api/weather/weekly`.
3. Trim `/api/children` payload for header/filter use if interests are not needed there.
4. Simplify unread-count route work, but only after mount scope is reduced.

## Safe fixes to do first

These are the smallest and safest first changes:

1. Deduplicate providers between [src/app/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/layout.tsx) and [src/components/providers/PublicProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/PublicProviders.tsx).
2. Add a shared cached `resolveCityIdBySlug()` helper for both geo routes.
3. Add `Cache-Control` headers to `/api/weather/weekly`.
4. Prevent unread badge bootstrap on surfaces where notification UI is absent.
5. Extend skip logic from only `/me` and `/admin` to other surfaces that do not need public discovery data.

## Notes and assumptions

- This audit is based on code paths, provider placement, and route implementations, not a live browser waterfall.
- The report intentionally avoids recommending a large runtime rewrite.
- Some global providers not listed in the requested scope, such as `MyPlanProvider`, likely deserve a separate pass because they are mounted high in the tree and may have their own runtime costs.
