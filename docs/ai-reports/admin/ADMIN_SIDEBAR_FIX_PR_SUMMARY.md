# PR Summary: Fix Admin Sidebar URLs

## Problem
Admin sidebar navigation links were missing the `/admin` prefix, causing 404 errors when clicking on Signals, Districts, Metro Stations, and Filters.

## Solution
Updated `src/app/admin/layout.tsx` to include `/admin` prefix in all navigation links using a helper function for maintainability.

## Changes

### File Modified
- **`src/app/admin/layout.tsx`**

### What Changed
1. Added `ADMIN_BASE` constant: `/admin`
2. Added `adminPath()` helper function
3. Updated 5 navigation links:
   - Dashboard: `/` → `/admin`
   - Signals: `/taxonomy/signals` → `/admin/taxonomy/signals`
   - Districts: `/taxonomy/districts` → `/admin/taxonomy/districts`
   - Metro Stations: `/taxonomy/metro-stations` → `/admin/taxonomy/metro-stations`
   - Filters: `/discovery/filters` → `/admin/discovery/filters`

## URLs Fixed
- ✅ `http://localhost:3000/admin` - Dashboard
- ✅ `http://localhost:3000/admin/taxonomy/signals`
- ✅ `http://localhost:3000/admin/taxonomy/districts`
- ✅ `http://localhost:3000/admin/taxonomy/metro-stations`
- ✅ `http://localhost:3000/admin/discovery/filters`

## Testing
- ✅ Build passes: `pnpm build` (3.5s)
- ✅ TypeScript check passes: `pnpm tsc --noEmit`
- ✅ All admin pages verified to exist
- ✅ No breaking changes to public or business routes

## Impact
- Fixes navigation for all admin taxonomy and discovery sections
- Improves admin UX by eliminating 404 errors
- Adds maintainability with centralized admin path helper
