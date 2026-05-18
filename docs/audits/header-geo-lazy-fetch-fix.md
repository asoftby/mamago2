# Header Geo Lazy Fetch Fix

Date: 2026-05-18
Scope: lazy loading for public header geo reference data (`districts` + `metro-stations`)
Related audit: `docs/audits/runtime-network-audit.md`

## What changed

Before this change, the public header mounted `HeaderDiscoveryFiltersProvider` high in the public tree and the provider fetched geo reference data immediately on client mount for the active city:

- `/api/geo/districts?citySlug=...`
- `/api/geo/metro-stations?citySlug=...`

That meant a plain public page visit triggered geo requests even if the user never opened search or location filters.

Now the shared header provider stays mounted, but it no longer fetches on mount. Geo data is loaded on demand through an explicit `loadGeoFilters()` method.

## Where lazy preload now happens

Geo preload now starts only from header interactions or from pages/states where the labels are already needed:

- `src/components/mobile/MobileSearchSheet.tsx`
  - calls `loadGeoFilters(pendingCitySlug)` when the mobile search sheet opens
  - also covers city changes while the sheet is already open
- `src/components/site/header/DesktopSearchControl.tsx`
  - calls `loadGeoFilters(...)` when the desktop location panel opens
  - calls `loadGeoFilters(...)` when the compact desktop search capsule expands into search UI
- `src/components/mobile/MobileSearchEntry.tsx`
  - explicitly preloads only when an active `metro` or `district` filter is already applied and the header summary needs human-readable labels
- `src/components/site/header/DesktopSearchControl.tsx`
  - same explicit preload for active location filters in desktop summary states

The public header wrapper still uses one shared provider for desktop/mobile trees, so we keep the “single source for the active city” behavior without the previous mount-time fetch.

## Cache and in-flight dedupe

Client-side caching and request dedupe are handled in `src/features/filters/discovery/geoFilterOptionsClient.ts`.

- Cache key: `citySlug`
- Cache lifetime: current browser session / module lifetime
- Reopen behavior:
  - if the same city was already loaded, reopening search/location UI reuses cached data
  - no repeat request should be sent for the same city in the same tab session
- In-flight dedupe:
  - concurrent callers for the same `citySlug` share one promise
  - desktop/mobile open flows can safely request preload without creating duplicate network traffic

`HeaderDiscoveryFiltersProvider` now reads from that shared cache and exposes `hasLoaded`, `loading`, and `loadGeoFilters()` instead of starting the request automatically.

## Checked flows

Implementation targets these flows:

- Public page load without opening search:
  - `/{city}`
  - `/{city}/events/[slug]`
  - `/routes/[slug]`
- Desktop header:
  - compact search expand
  - location panel open
  - repeat open without duplicate request
- Mobile header:
  - search sheet open
  - repeat open without duplicate request
- City change while search UI is open

## Remaining risks

- If a route shows an already-applied `metro` or `district` filter in the header summary, the code now allows a targeted preload so labels do not degrade to raw ids. This is intentional, but it means “no geo request on load” is guaranteed only for pages without active location filters.
- `useDiscoveryFilterOptions()` still auto-fetches outside the deferred header flow. That is expected for non-header surfaces where filters are rendered immediately, but other public filter surfaces may still deserve their own audit later.
- This change does not touch weather, notifications, or broader header architecture.
