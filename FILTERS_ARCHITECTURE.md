# Filters Architecture - Current State

## Overview
Система фильтров для страниц discovery (Куда пойти, Занятия, День рождения).

## Single Source of Truth

### ✅ Main Implementation
**Location:** `src/features/filters/discovery/`

**Core Files:**
- `DiscoveryFilters.tsx` - Main component with desktop/mobile UI
- `filters.store.ts` - Zustand store for filter state
- `filters.api.ts` - API client for loading filter options

**State Management:**
- `applied` - Committed filter values (synced with URL)
- `draft` - Temporary values while editing (mobile sheet)
- `actions` - Methods to apply, reset, clear filters

**Filter Types:**
- Date (when) - `dateFrom`, `dateTo` (ISO strings)
- Age - `age[]` (array of age group IDs)
- Metro - `metro[]` (array of metro station IDs)
- District - `district` (single district ID)

### Public API
**Location:** `src/features/discovery/filters/DiscoveryFilters.tsx`

Simple wrapper that provides variant prop and passes through to main implementation:
```tsx
<DiscoveryFilters 
  variant="auto" // or "desktop" | "mobile"
  citySlug="minsk"
  onChange={() => {}}
/>
```

## UI Primitives (Reusable)

### WhenSelect
**Location:** `src/components/ui/when-select.tsx`

Date/range picker with presets (Today, Tomorrow, Weekend).
- Desktop: Popover with calendar
- Mobile: Bottom sheet with calendar
- Displays selected date in trigger

### CardSelect
**Location:** `src/components/ui/card-select.tsx`

Single-select dropdown with card-style trigger.
- Shows selected option label
- Clear button when selected
- Works with any options array

### CardMultiSelect
**Location:** `src/components/ui/card-multiselect.tsx`

Multi-select dropdown with card-style trigger.
- Shows "Label +N" for multiple selections
- Clear button when selected
- Works with any options array

## Data Flow

### 1. Options Loading
```
Page Load → filters.api.fetchDiscoveryFilters(citySlug)
  ↓
Parallel API calls:
  - /api/discovery/filters (age groups)
  - /api/geo/metro-stations?citySlug=minsk
  - /api/geo/districts?citySlug=minsk
  ↓
Store updates options state
```

### 2. Filter Selection (Desktop)
```
User clicks filter → Opens popover
  ↓
User selects value → onChange called immediately
  ↓
setDraft() + actions.apply()
  ↓
URL params updated
  ↓
Trigger shows selected value
```

### 3. Filter Selection (Mobile)
```
User clicks "Фильтры" → Opens sheet
  ↓
User changes values → Updates draft state
  ↓
User clicks "Готово" → actions.apply()
  ↓
URL params updated
  ↓
Sheet closes, trigger shows count
```

## API Endpoints

### Filter Options
- `GET /api/discovery/filters` - Age groups (from FilterDefinition)
- `GET /api/geo/metro-stations?citySlug=minsk` - Metro stations
- `GET /api/geo/districts?citySlug=minsk` - Districts

All endpoints:
- Return only active items
- Ordered by `orderIndex` then `name`
- 5-minute cache revalidation

## Usage in Pages

### City Intent Pages
**Location:** `src/components/city/CityIntentShell.tsx`

```tsx
<DiscoveryFilters citySlug={city} />
```

Automatically:
- Loads options for the city
- Syncs with URL params
- Updates URL on filter changes
- Shows selected values in triggers

## Key Features

### ✅ URL-Based State
- All filter state stored in URL search params
- Browser back/forward works correctly
- Shareable URLs with filters

### ✅ Responsive
- Desktop: Inline pills with popovers
- Mobile: Single "Фильтры" button with sheet

### ✅ Database-Backed Options
- Metro stations from database
- Districts from database
- Age groups from FilterDefinition

### ✅ Proper Value Display
- WhenSelect shows selected date (not "Выберите...")
- CardSelect shows selected label
- CardMultiSelect shows "Label +N"

## Files to Keep

### Core Implementation
- `src/features/filters/discovery/` - **KEEP ALL**
- `src/features/discovery/filters/DiscoveryFilters.tsx` - **KEEP** (public wrapper)

### UI Primitives
- `src/components/ui/when-select.tsx` - **KEEP**
- `src/components/ui/card-select.tsx` - **KEEP**
- `src/components/ui/card-multiselect.tsx` - **KEEP**

### Supporting Components
- `src/components/discovery/FilterFieldPill.tsx` - **KEEP** (mobile trigger)
- `src/components/discovery/MobileFilterSheet.tsx` - **KEEP** (mobile UI)
- `src/components/filters/MobileSelectSheet.tsx` - **KEEP** (used by CardSelect/Multi)

### API Routes
- `src/app/api/discovery/filters/route.ts` - **KEEP**
- `src/app/api/geo/metro-stations/route.ts` - **KEEP**
- `src/app/api/geo/districts/route.ts` - **KEEP**

## Legacy/Unused Files

### Can Be Removed (if not used elsewhere)
- `src/features/filters/components/FilterBar.tsx` - Old implementation
- `src/features/filters/ui/FilterPill.tsx` - Old single-line pill
- `src/features/filters/presets/` - Old preset system
- `src/features/discovery/filters/filters.store.ts` - Duplicate store (if exists)
- `src/features/discovery/filters/filters.types.ts` - Duplicate types (if exists)

**Note:** Check usage before deleting. Some may be used in ui-lab demos.

## Testing

### Manual Testing Checklist
1. ✅ Open `/minsk` page
2. ✅ Click "Когда идём" - calendar opens
3. ✅ Select date - trigger shows selected date
4. ✅ Click "Возраст" - dropdown opens
5. ✅ Select age - trigger shows selected label
6. ✅ Click "Метро" - dropdown opens with DB data
7. ✅ Select metro - trigger shows selected label
8. ✅ Click "Район" - dropdown opens with DB data
9. ✅ Select district - trigger shows selected label
10. ✅ Check URL - params updated
11. ✅ Refresh page - filters persist
12. ✅ Clear filters - all reset to "Выберите..."

### Mobile Testing
1. ✅ Open on mobile viewport
2. ✅ Click "Фильтры" button
3. ✅ Sheet opens with all filters
4. ✅ Change multiple filters
5. ✅ Click "Готово" - sheet closes
6. ✅ Trigger shows count (e.g., "3")
7. ✅ URL updated with all params

## Future Improvements

### Nice to Have
- [ ] Add filter presets (save/load combinations)
- [ ] Add "Recently used" filters
- [ ] Add filter analytics
- [ ] Add keyboard shortcuts
- [ ] Add filter validation
- [ ] Add loading skeletons for options

### Performance
- [ ] Debounce URL updates
- [ ] Optimize re-renders
- [ ] Add virtual scrolling for long option lists
- [ ] Cache options in localStorage

## Troubleshooting

### Filters not showing selected values
- Check that `value` prop is passed correctly
- Check that options array includes the selected value
- Check browser console for errors

### Options not loading
- Check API endpoints are accessible
- Check city slug is correct
- Check database has data for the city

### URL not updating
- Check `actions.apply()` is called
- Check router is available
- Check URL params serialization

## Documentation

For detailed implementation docs, see:
- `FILTER_FIXES_COMPLETE.md` - Filter options from DB
- `WHENSELECT_FIX_COMPLETE.md` - WhenSelect improvements
- `DISCOVERY_FILTERS_ONCHANGE_FIX.md` - onChange callback
- `FILTER_VALUE_DISPLAY_FIX.md` - Value display fixes
