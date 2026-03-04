# Discovery Filters UX Improvements - Complete

## Changes Implemented

### 1. Metro Filter: Multi-Select → Single-Select ✅

Changed metro filter from multiple selection to single selection.

#### Store Changes (`src/features/filters/discovery/filters.store.ts`)
- Changed `metro` type from `string[]` to `string | null`
- Updated `defaultFilters.metro` from `[]` to `null`
- Updated URL parsing to support single value (with backward compatibility for comma-separated)
- Updated URL serialization to write single value

#### UI Changes
**Desktop** (`src/features/filters/discovery/DiscoveryFilters.tsx`):
- Replaced `CardMultiSelect` with `CardSelect`
- Updated handler: `handleMetroChange(value: string | null)`
- Updated binding: `value={applied.metro}` instead of `values={applied.metro}`

**Mobile** (`src/components/discovery/MobileFilterSheet.tsx`):
- Changed to single-select mode: `isMulti={false}`
- Updated label helper to use `getSingleLabel` instead of `getMultiLabel`
- Updated handler to set single value and close sheet immediately
- Updated clear handler: `setDraft({ metro: null })`

### 2. When Preset Labels with Dates ✅

Added support for displaying preset labels with actual dates.

#### New Utility File (`src/features/filters/discovery/whenLabel.ts`)
Created date formatting utility with Russian locale support using `date-fns`:

```typescript
- "Сегодня • 5 мар."
- "Завтра • 6 мар."
- "Эти выходные • 7–8 мар."
```

Features:
- Uses `date-fns` with Russian locale
- Handles same-month ranges: "7–8 мар."
- Handles cross-month ranges: "30 мар. – 1 апр."
- Computes weekend as Saturday-Sunday of current week
- Fallback to date strings if no preset

#### Store Changes
- Added `whenPreset` field: `"TODAY" | "TOMORROW" | "WEEKEND" | null`
- Updated `defaultFilters` to include `whenPreset: null`
- Updated URL parsing to read `preset` param
- Updated URL serialization to write `preset` param
- Updated `derived.dateLabel` to use `whenLabel()` helper

#### Handler Updates
**Desktop handlers** now set preset instead of converting to dates:
- `'today'` → `{ whenPreset: "TODAY", dateFrom: null, dateTo: null }`
- `'tomorrow'` → `{ whenPreset: "TOMORROW", dateFrom: null, dateTo: null }`
- `'weekend'` → `{ whenPreset: "WEEKEND", dateFrom: null, dateTo: null }`
- Calendar selection → `{ whenPreset: null, dateFrom: "...", dateTo: "..." }`

**Mobile handlers** updated in `MobileFilterSheet.tsx`:
- Preset buttons set `whenPreset` in draft
- Calendar selection clears `whenPreset`
- Label uses `whenLabel(draft)` helper

### 3. Desktop Layout: Full Width, One Row ✅

Updated desktop filters layout to stretch full width with equal-sized filters.

#### Layout Changes (`src/features/filters/discovery/DiscoveryFilters.tsx`)
```tsx
// Before:
<div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-x-[12px] pb-2 items-center py-1">
  <WhenSelect className="w-auto min-w-[160px]" />
  <CardMultiSelect className="w-auto min-w-[140px]" />
  // ...
</div>

// After:
<div className="w-full flex gap-3 items-center py-1">
  <WhenSelect className="flex-1 min-w-0" />
  <CardMultiSelect className="flex-1 min-w-0" />
  <CardSelect className="flex-1 min-w-0" />
  <CardSelect className="flex-1 min-w-0" />
</div>
```

Changes:
- Container: `w-full flex gap-3` (full width, consistent gap)
- Each filter: `flex-1 min-w-0` (equal flex grow, prevent overflow)
- Removed: `flex-nowrap overflow-x-auto no-scrollbar` (no horizontal scroll)
- Reset button: Fixed width `w-[40px]` (doesn't grow)

## Dependencies Added

```bash
pnpm add date-fns
```

## Data Flow

### Desktop Flow (Immediate Apply)
```
User selects preset → handleWhenChangeDesktop() → updateUrlImmediately({ whenPreset: "TODAY" }) 
→ URL updated → applied state updates → whenLabel() computes display → "Сегодня • 5 мар."
```

### Mobile Flow (Draft → Apply)
```
User selects preset → setDraft({ whenPreset: "TODAY" }) → draft updated → whenLabel(draft) 
→ "Сегодня • 5 мар." shown in sheet → User clicks "Готово" → actions.apply() 
→ URL updated → applied state updates
```

## URL Parameters

```
?preset=TODAY          # Preset selected
?preset=TOMORROW
?preset=WEEKEND
?from=2026-03-05       # Calendar date selected (clears preset)
?from=2026-03-07&to=2026-03-08  # Date range
?metro=<id>            # Single metro station (changed from comma-separated)
?age=0-3,3-6           # Age groups (still multi-select)
?district=<id>         # Single district
```

## Files Modified

1. `src/features/filters/discovery/filters.store.ts` - Store types and logic
2. `src/features/filters/discovery/DiscoveryFilters.tsx` - Desktop UI and handlers
3. `src/components/discovery/MobileFilterSheet.tsx` - Mobile UI
4. `src/features/filters/discovery/whenLabel.ts` - NEW: Date formatting utility

## Testing Checklist

- [x] Metro filter shows single selection on desktop
- [x] Metro filter shows single selection on mobile
- [x] Preset "Сегодня" shows "Сегодня • [date]"
- [x] Preset "Завтра" shows "Завтра • [date]"
- [x] Preset "Эти выходные" shows "Эти выходные • [date range]"
- [x] Calendar selection clears preset and shows date
- [x] Desktop filters stretch full width in one row
- [x] Desktop filters have equal widths
- [x] Mobile filters work with draft → Apply flow
- [x] URL params update correctly
- [x] No TypeScript errors
- [x] Server compiles successfully

## Status: ✅ COMPLETE

All three UX improvements have been implemented:
1. Metro is now single-select
2. Preset labels show with actual dates in Russian format
3. Desktop layout stretches full width with equal-sized filters in one row

Server is running on port 3002: http://localhost:3002
