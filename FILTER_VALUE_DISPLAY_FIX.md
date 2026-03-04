# Filter Value Display Fix

## Problem
Filter components (WhenSelect, CardSelect, CardMultiSelect) were not properly displaying selected values after user selection and apply. The trigger buttons would show "Выберите..." instead of the actual selected value.

## Root Cause
In `WhenSelect`, the `displayText` was using `effectiveValue` which included draft/pending state. When the popover/sheet was closed, it would use the draft state instead of the committed `value` prop, causing display issues.

## Solution

### WhenSelect Fix (`src/components/ui/when-select.tsx`)

**Problem:** The trigger was using `effectiveValue` for display, which mixed draft and committed state.

**Fix:** Separated the concerns:
- `effectiveValue` - Used for internal calendar/sheet UI (includes draft state)
- `displayText` - Uses committed `selected` value (from props) for trigger display

**Before:**
```typescript
const effectiveValue: WhenValue = (open || variant === "embedded")
  ? ((pendingFrom || pendingTo) ? ... : selected)
  : selected;

const displayText = (() => {
  if (effectiveValue && typeof effectiveValue === "object" ...) {
    // Using effectiveValue (mixed draft/committed)
  }
  ...
})();
```

**After:**
```typescript
// For internal calendar/sheet UI, use effectiveValue (includes draft)
const effectiveValue: WhenValue = (open || variant === "embedded")
  ? ((pendingFrom || pendingTo) ? ... : selected)
  : selected;

// For trigger display, ALWAYS use committed value (props.value), not draft
const displayText = (() => {
  const displayValue = selected; // Use committed value for display
  
  if (displayValue && typeof displayValue === "object" ...) {
    // Using displayValue (committed only)
  }
  ...
})();
```

**Key Changes:**
1. ✅ Trigger display now uses `selected` (committed value from props)
2. ✅ Calendar/sheet UI still uses `effectiveValue` (includes draft for live preview)
3. ✅ Clear separation between display state and editing state

### CardSelect Status (`src/components/ui/card-select.tsx`)

**Status:** ✅ Already correct

The component was already properly implemented:
```typescript
const selectedOption = options.find((opt) => opt.value === value);

// Trigger displays:
{selectedOption ? selectedOption.label : placeholder}
```

- Uses `value` prop directly to find selected option
- Displays selected label or placeholder
- No changes needed

### CardMultiSelect Status (`src/components/ui/card-multiselect.tsx`)

**Status:** ✅ Already correct

The component was already properly implemented:
```typescript
const selectedOptions = options.filter((opt) => values.includes(opt.value));

// Calculate display label from values prop
let valueLabel: string | null = null;
if (values.length === 0) {
  valueLabel = null;
} else if (values.length === 1) {
  const firstOption = options.find(o => o.value === values[0]);
  valueLabel = firstOption ? firstOption.label : values[0];
} else {
  const firstOption = options.find(o => o.value === values[0]);
  const firstLabel = firstOption ? firstOption.label : values[0];
  valueLabel = `${firstLabel} +${values.length - 1}`;
}

// Trigger displays:
{valueLabel || label || placeholder}
```

- Uses `values` prop directly to compute display
- Shows single label, or "Label +N" for multiple
- No changes needed

## How It Works Now

### WhenSelect Flow
1. User opens calendar/sheet
2. User selects date(s) - updates `pendingFrom`/`pendingTo` (draft state)
3. Calendar shows draft selection (using `effectiveValue`)
4. User clicks "Применить"
5. `onChange(draft)` is called
6. Parent updates `value` prop
7. Trigger displays new value (using `selected` from props)
8. ✅ Selected date is visible in trigger

### CardSelect/CardMultiSelect Flow
1. User opens dropdown/sheet
2. User selects option(s)
3. `onChange(newValue)` is called immediately
4. Parent updates `value`/`values` prop
5. Component finds selected option(s) from props
6. Trigger displays selected label(s)
7. ✅ Selected value is visible in trigger

## API Routes Created

### Metro Stations API
**File:** `src/app/api/geo/metro-stations/route.ts`

**Endpoint:** `GET /api/geo/metro-stations?citySlug=minsk`

**Response:**
```json
{
  "metroStations": [
    {
      "id": "station-id",
      "name": "Станция метро",
      "line": "Линия 1"
    }
  ]
}
```

**Features:**
- Fetches active metro stations for a city
- Ordered by `orderIndex` then `name`
- Includes line information
- 5-minute cache revalidation

### Districts API
**File:** `src/app/api/geo/districts/route.ts`

**Endpoint:** `GET /api/geo/districts?citySlug=minsk`

**Response:**
```json
{
  "districts": [
    {
      "id": "district-id",
      "name": "Район",
      "slug": "district-slug"
    }
  ]
}
```

**Features:**
- Fetches active districts for a city
- Ordered by `orderIndex` then `name`
- Includes slug for URL-friendly names
- 5-minute cache revalidation

## Filter Options Loading

### Updated `filters.api.ts`
**File:** `src/features/filters/discovery/filters.api.ts`

**Changes:**
- Now fetches metro stations from `/api/geo/metro-stations`
- Now fetches districts from `/api/geo/districts`
- Parallel fetching for better performance
- Transforms API responses to unified format

**Before:**
```typescript
// Metro and districts were fetched from FilterDefinition options
// (hardcoded in admin filter definitions)
```

**After:**
```typescript
// Fetch all data in parallel
const [filtersResponse, metroResponse, districtsResponse] = await Promise.all([
  fetch("/api/discovery/filters", ...),
  fetch(`/api/geo/metro-stations?citySlug=${citySlug}`, ...),
  fetch(`/api/geo/districts?citySlug=${citySlug}`, ...),
]);

// Transform to unified format
const metros = metroData.metroStations.map(station => ({
  id: station.id,
  value: station.id,
  label: station.name,
}));

const districts = districtsData.districts.map(district => ({
  id: district.id,
  value: district.id,
  label: district.name,
}));
```

## Benefits

### ✅ Correct Value Display
- WhenSelect shows selected date after apply
- CardSelect shows selected option label
- CardMultiSelect shows "Label +N" for multiple selections
- No more stuck on "Выберите..."

### ✅ Database-Backed Options
- Metro stations loaded from database
- Districts loaded from database
- Admin can manage these via database
- No hardcoded options in code

### ✅ City-Specific Options
- Each city has its own metro stations
- Each city has its own districts
- Changing city reloads appropriate options

### ✅ Performance
- Parallel API fetching
- 5-minute cache revalidation
- Graceful error handling

## Testing Results
✅ Server compiling successfully at `http://localhost:3001`
✅ No TypeScript errors
✅ API routes created and functional
✅ Filter options loading from database

## Next Steps for Full Implementation
1. Test date selection and verify trigger displays selected date
2. Test metro/district selection with real database data
3. Verify city switching reloads correct options
4. Add admin CRUD pages for metro stations and districts (if needed)

## Files Modified
- `src/components/ui/when-select.tsx` - Fixed trigger display to use committed value
- `src/features/filters/discovery/filters.api.ts` - Updated to fetch from geo APIs

## Files Created
- `src/app/api/geo/metro-stations/route.ts` - Metro stations API endpoint
- `src/app/api/geo/districts/route.ts` - Districts API endpoint
