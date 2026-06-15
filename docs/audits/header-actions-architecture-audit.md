# Header Actions Architecture Audit

Date: 2026-06-12

## Scope

Public shell and public detail pages:

- `src/components/site/header/*`
- `src/components/shared/MobileSmartBackButton.tsx`
- `src/hooks/useSmartBack.ts`
- public detail pages and article views using mobile back button

Audited separately, not changed:

- `src/components/admin/AdminHeader.tsx`
- `src/components/business/layout/BusinessHeader.tsx`

Legacy / prototype / currently unused header-like files:

- `src/components/shell/PublicHeader.tsx`
- `src/components/site/header/HeaderChrome.tsx`
- `src/components/site/header/HeaderTopChrome.tsx`
- `src/components/site/header/SiteHeaderNew.tsx`
- `src/components/mobile/MobileLandingHeaderChrome.tsx`

## Headers Found

### Active public headers

1. `src/app/(public)/layout.tsx`
   Mount point for the public shell. Uses `SiteHeader`.

2. `src/components/site/header/SiteHeader.tsx`
   Breakpoint switcher:
   - desktop: `DesktopHeader`
   - mobile: `MobileHeader`

3. `src/components/site/header/Header.tsx`
   Main desktop public header.
   Current actions:
   - logo -> city home
   - search -> now unified public search open action
   - profile -> `HeaderAccountMenu`
   - notifications -> inside `HeaderAccountMenu` for authenticated users

4. `src/components/site/header/MobileHeader.tsx`
   Main mobile public header.
   Current actions:
   - search entry -> opens `MobileSearchSheet`
   - filters -> `MobileFilterButton` where available
   - no dedicated logo/profile/bell/menu buttons in the active mobile shell

### Active public detail-page header-like controls

1. `src/components/shared/MobileSmartBackButton.tsx`
   Reused mobile back action for:
   - events
   - offers
   - places
   - routes
   - articles
   - custom pages
   - birthday page

2. `src/components/navigation/HistoryBackButton.tsx`
   Separate back control for settings/backoffice-like layouts.
   Not part of the public header fix.

### Auth / account / notifications action layer

1. `src/components/site/header/HeaderAccountMenu.tsx`
   Public desktop profile trigger.
   Behavior:
   - guest -> opens `DefaultAuthModal` with `nextHref=currentPath`
   - auth -> opens `ProfileDropdown`
   - auth desktop -> also renders `NotificationsDropdown`

2. `src/components/site/header/NotificationsDropdown.tsx`
   Unified notifications UI:
   - public/admin/business share one component
   - desktop -> popover
   - mobile -> modal/sheet

## Mismatches Found

### Fixed

1. Desktop landing search mismatch in `src/components/site/header/Header.tsx`
   Previous behavior:
   - on landing/public-detail routes the search icon linked to `/${citySlug}/kuda`
   - this bypassed real search and behaved like navigation to a listing page
   Expected behavior:
   - search icon always opens public search
   Fix:
   - replaced direct link behavior with a shared public-search open action

2. Desktop search source-of-truth mismatch
   Previous behavior:
   - desktop search overlay mounted only for non-landing routes or place pages
   - even if a search action existed on other landing pages, overlay could not open there
   Fix:
   - desktop `SearchOverlay` is now mounted consistently
   - search open is driven through a shared event

3. Smart-back fallback hardcodes
   Previous behavior:
   - several public detail pages hardcoded `/minsk` or `/`
   Fix:
   - `useSmartBack()` now defaults to current city home via shared helper
   - pages without explicit city context now fall back to current city preference, then `/minsk`

### Audited but intentionally not changed

1. Public mobile shell has no bell/profile/menu icon in the active header
   - no visual inconsistency to fix because those actions are not rendered there

2. Admin/business headers
   - already use shared `NotificationsDropdown`
   - profile behavior is already centralized through account dropdown handlers
   - no public-search bug there

3. Legacy/prototype headers
   - `PublicHeader`, `HeaderChrome`, `HeaderTopChrome`, `SiteHeaderNew` still contain old hardcoded links
   - they are not part of the active public shell
   - should be cleaned up later or removed to reduce future confusion

## Implemented Source Of Truth

### Search

- `src/lib/search/openPublicSearchEvent.ts`
  - `OPEN_PUBLIC_SEARCH_EVENT`
  - `dispatchOpenPublicSearch()`

Desktop listener:

- `src/components/site/header/Header.tsx`
  - opens `SearchOverlay`

Mobile listener:

- `src/components/site/header/MobileHeader.tsx`
  - opens `MobileSearchSheet`

Compatibility bridge:

- `src/lib/mobile/openMobileSearchEvent.ts`
  - now also dispatches the shared public-search event

### City home / logo fallback

- `src/lib/header/getCityHomeHref.ts`
  - `getCityHomeHref(citySlug)`

### Smart back

- `src/hooks/useCityHomeHref.ts`
- `src/hooks/useSmartBack.ts`

Behavior now:

- same-origin internal navigation -> `router.back()`
- external/SEO/direct entry -> current city home
- no city context -> `/minsk`

## Files Changed

- `src/components/site/header/Header.tsx`
- `src/components/site/header/MobileHeader.tsx`
- `src/components/mobile/MobileLandingHeaderChrome.tsx`
- `src/components/shared/MobileSmartBackButton.tsx`
- `src/hooks/useSmartBack.ts`
- `src/hooks/useCityHomeHref.ts`
- `src/lib/header/getCityHomeHref.ts`
- `src/lib/search/openPublicSearchEvent.ts`
- `src/lib/mobile/openMobileSearchEvent.ts`
- `src/components/article/mvp/ArticleMvpView.tsx`
- `src/components/article/mvp/BreakingNewsView.tsx`
- `src/app/(public)/blog/[slug]/page.tsx`
- `src/app/(public)/page/[slug]/page.tsx`
- `src/app/(public)/routes/[slug]/RouteDetailClient.tsx`

## Verification

Core header-action layer status:

- checked after implementation
- search open event, city-home helper, and smart-back source of truth were re-reviewed before commit preparation

Type checks:

- `pnpm exec tsc --noEmit` -> passed

Lint:

- targeted `pnpm lint ...` on touched files -> failed on a pre-existing issue in `src/components/article/mvp/BreakingNewsView.tsx`
- failing rule:
  - `react-hooks/immutability` at the existing `textBlockIndex += 1` logic
- additional warnings were existing `no-img-element` / unused-vars warnings in the same route/article files
- wide lint for the broader touched surface is therefore blocked by old `BreakingNewsView.tsx` debt and those existing warnings, not by the core header-action layer

## Technical Debt Left

1. Remove or archive unused header prototypes with hardcoded `/minsk`
   - `PublicHeader`
   - `HeaderChrome`
   - `HeaderTopChrome`
   - `SiteHeaderNew`

2. If public mobile header later adds bell/profile/menu icons, wire them through the same shared action layer instead of route links.

3. `BreakingNewsView.tsx` contains pre-existing lint debt unrelated to this header action fix.
   - `react-hooks/immutability`
   - existing `no-img-element` / `unused-vars` warnings in the same wider checked surface
   - treated as separate technical debt and intentionally not fixed in this change
