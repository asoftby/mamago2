# City Resolution Fix - Complete

## Problem Identified

The active city disappeared from the app UI because the `getCityFromPath()` function was incorrectly treating non-city routes as cities.

### Root Cause

The function naively extracted the first URL segment and assumed it was always a city:

```typescript
// OLD - BROKEN
export function getCityFromPath(pathname: string | null): string {
  if (!pathname) return "minsk";
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] || "minsk";
}
```

This caused issues when users visited:
- `/me` → returned "me" as city
- `/login` → returned "login" as city
- `/places/slug` → returned "places" as city

The header components would then either:
1. Try to display invalid city names
2. Hide the city display entirely
3. Fail to show city-specific UI elements
4. Cause API errors when fetching filter options with invalid city slugs

## Solution Implemented

Updated `getCityFromPath()` to validate segments against known cities and non-city routes:

```typescript
// NEW - FIXED
const VALID_CITY_SLUGS = ["minsk"];
const NON_CITY_ROUTES = [
  "me", "login", "register", "forgot-password", 
  "reset-password", "places", "ui-test", "account",
  "admin", "business", "api", "_next"
];

export function getCityFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (!firstSegment) return null;
  
  // Check if first segment is a known non-city route
  if (NON_CITY_ROUTES.includes(firstSegment)) {
    return null;
  }
  
  // Check if first segment is a valid city slug
  if (VALID_CITY_SLUGS.includes(firstSegment)) {
    return firstSegment;
  }
  
  // Unknown segment - return null to be safe
  return null;
}
```

## Changes Made

### 1. Updated `src/lib/intent.ts`
- Added `VALID_CITY_SLUGS` array with known cities
- Added `NON_CITY_ROUTES` array with known non-city routes
- Changed return type from `string` to `string | null`
- Added validation logic to check segments

### 2. Updated `src/components/city/DiscoveryIntentTabs.tsx`
- Changed `city` prop type from `string` to `string | null`
- Added early return if `city` is null (AFTER all hooks to avoid React Hooks rule violation)
- Added null check in `buildUrlWithFilters` function

### 3. Updated `src/features/filters/discovery/filters.api.ts`
- Changed `citySlug` parameter type from `string` to `string | null`
- Added early return in `useDiscoveryFilterOptions` if citySlug is null
- Prevents API errors when on non-city pages

### 4. Updated `src/components/site/header/SiteHeader.desktop.tsx`
- Already handled null city correctly via `shouldShowFilters` check
- No changes needed

### 5. Updated `src/components/site/header/SiteHeader.mobile.tsx`
- Already had fallback: `citySlug={currentCity || "minsk"}`
- No changes needed

## Test Results

Before fix:
```
Path: /me       → City: "me" (WRONG!)
Path: /login    → City: "login" (WRONG!)
Path: /places/x → City: "places" (WRONG!)
```

After fix:
```
Path: /me       → City: null (CORRECT)
Path: /login    → City: null (CORRECT)
Path: /places/x → City: null (CORRECT)
Path: /minsk    → City: "minsk" (CORRECT)
```

## Behavior

### On City Routes (`/minsk`, `/minsk/classes`, etc.)
- City is correctly extracted: `"minsk"`
- Header shows city-specific UI
- Intent tabs are displayed
- Filters work correctly

### On Non-City Routes (`/me`, `/login`, `/places/slug`)
- City returns `null`
- Header hides city-specific UI gracefully
- Intent tabs are not displayed
- No broken city names shown
- No API errors for filter options

### On Root Route (`/`)
- Middleware redirects to `/minsk`
- City is then correctly extracted

## React Hooks Fix

Fixed "Rendered more hooks than during the previous render" error by ensuring the early return happens AFTER all hooks are called:

```typescript
// WRONG - Violates Rules of Hooks
export function Component({ city }) {
  if (!city) return null; // ❌ Early return before hooks
  
  const [state, setState] = useState();
  useEffect(() => {}, []);
}

// CORRECT - All hooks called before early return
export function Component({ city }) {
  const [state, setState] = useState();
  useEffect(() => {}, []);
  
  if (!city) return null; // ✅ Early return after all hooks
}
```

## Future Improvements

1. **Dynamic City List**: Instead of hardcoding `VALID_CITY_SLUGS`, fetch from database or config
2. **City Context Provider**: Create a React context to avoid pathname parsing in every component
3. **Route Groups**: Use Next.js route groups to better separate city vs non-city routes
4. **Middleware Enhancement**: Handle city resolution in middleware for better performance

## Files Modified

- `src/lib/intent.ts` - Core fix
- `src/components/city/DiscoveryIntentTabs.tsx` - Handle null city + fix hooks
- `src/features/filters/discovery/filters.api.ts` - Handle null citySlug
- `scripts/debug-city-resolution.ts` - Debug script (new)
- `scripts/list-cities.ts` - Helper script (new)

## Testing

Run debug script to verify:
```bash
npx tsx scripts/debug-city-resolution.ts
```

Visit these URLs to test:
- http://localhost:3000/ (redirects to /minsk)
- http://localhost:3000/minsk (shows city UI)
- http://localhost:3000/me (no city UI, no errors)
- http://localhost:3000/login (no city UI, no errors)
- http://localhost:3000/places/some-slug (no city UI, no errors)
