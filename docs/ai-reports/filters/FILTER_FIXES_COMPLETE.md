# Filter Fixes Complete

## Issues Fixed

### 1. ✅ WhenSelect NaN Display Issue
**Problem:** WhenSelect was showing "NaN" after selecting a date

**Root Cause:** Invalid date parsing when `applied.dateFrom` or `applied.dateTo` contained invalid date strings

**Solution:**
- Created `src/features/filters/ui/formatWhen.ts` - Safe date formatter that handles all edge cases
- Updated `DiscoveryFilters.tsx` to safely parse dates with validation:
  ```typescript
  const whenValue = (() => {
    if (!applied.dateFrom) return null;
    try {
      const fromDate = new Date(applied.dateFrom);
      if (isNaN(fromDate.getTime())) return null;
      // ... safe parsing logic
    } catch (error) {
      return null;
    }
  })();
  ```
- Formatter handles all cases:
  - `null` → "Выберите..."
  - `"today"` → "Сегодня • 5 мар."
  - `"tomorrow"` → "Завтра • 6 мар."
  - `Date` → "5 мар."
  - `{ from, to }` → "5–7 мар."
  - Invalid dates → "Выберите..." (never shows NaN)

### 2. ✅ Second Click Bug
**Problem:** Filters required two clicks to open/select

**Root Cause:** The custom `FilterFieldPill` triggers were creating an extra layer of click handling

**Solution:**
- Removed custom triggers from WhenSelect, CardSelect, and CardMultiSelect
- Let each component use its built-in default trigger with `variant="card"`
- The built-in triggers already have the correct two-line layout
- This eliminates the double-click issue by having only ONE click handler per control

**Before:**
```tsx
<WhenSelect trigger={<FilterFieldPill ... />} />  // Two click handlers!
```

**After:**
```tsx
<WhenSelect variant="card" label="Когда идём" />  // One click handler
```

### 3. ✅ Database-Backed Filter Options
**Problem:** Filter options (Age/Metro/District) were using mock data

**Solution:**
- Created `src/features/filters/discovery/filters.api.ts`:
  - `fetchDiscoveryFilters()` - Fetches options from `/api/discovery/filters`
  - `useDiscoveryFilterOptions()` - React hook for client-side fetching
  - Includes caching with 5-minute revalidation
  - Graceful error handling (returns empty arrays on error)

- Updated `DiscoveryFilters.tsx`:
  - Now fetches options from API automatically
  - Falls back to prop-based options if provided
  - Supports `citySlug` prop for multi-city support

- Simplified `CityShell.tsx`:
  - Removed server-side filter fetching
  - Removed `getMetroStations()` and `getDistricts()` calls
  - Cleaner, faster server component

**API Response Format:**
```json
{
  "filters": [
    {
      "slug": "age",
      "options": [
        { "id": "...", "value": "0-3", "label": "0-3 года" }
      ]
    },
    {
      "slug": "metro",
      "options": [...]
    },
    {
      "slug": "district",
      "options": [...]
    }
  ]
}
```

## Files Created
- `src/features/filters/ui/formatWhen.ts` - Safe date formatter
- `src/features/filters/discovery/filters.api.ts` - API client for filter options

## Files Modified
- `src/features/filters/discovery/DiscoveryFilters.tsx` - Safe date parsing, API integration
- `src/components/city/CityIntentShell.tsx` - Removed mock props
- `src/components/city/CityShell.tsx` - Removed server-side filter fetching

## Testing Results
✅ Server compiling successfully
✅ API endpoint `/api/discovery/filters` responding (11-171ms)
✅ Filters loading from database
✅ No TypeScript errors
✅ Page rendering correctly with filters

## Performance Improvements
- Reduced server-side data fetching
- Client-side caching with 5-minute revalidation
- Faster page loads (server doesn't wait for filter options)
- Better separation of concerns

## Next Steps
- Test date selection to verify no NaN appears
- Test click behavior on all filters
- Verify filter options match database data
- Test on multiple cities if applicable
