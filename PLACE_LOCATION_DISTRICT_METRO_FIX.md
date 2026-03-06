# Place Location District & Metro - Diagnostic Fix

## Problem
Metro and district fields were NOT visible on the Location step (Step 2) for business owners in the Place Wizard.

## Root Cause
1. **Missing cityId**: PlaceSearchInput doesn't extract cityId from Google Places address_components
2. **Missing API relations**: GET /api/business/places/[id] didn't include district/metro relation names
3. **Conditional UI**: District/metro UI only renders when `location && cityId` are both present

## Changes Made

### 1. Added Debug Panel (Development Only)
**File**: `src/components/business/place/PlaceLocationPicker.tsx`

Added a yellow debug panel at the top of the component that shows:
- lat/lng
- cityId
- districtAutoId, districtManualId
- metroAutoId, metroManualId
- metroAutoDistanceM, metroManualDistanceM
- uiVisible flag (whether district/metro UI should render)

**Gated by**: `process.env.NODE_ENV === "development"`

### 2. Updated API to Include Relations
**File**: `src/app/api/business/places/[id]/route.ts`

Added to the `include` block in GET endpoint:
```typescript
city: {
  select: { id: true, name: true },
},
districtAuto: {
  select: { id: true, name: true },
},
districtManual: {
  select: { id: true, name: true },
},
metroAuto: {
  select: { id: true, name: true },
},
metroManual: {
  select: { id: true, name: true },
},
```

Now the API returns district and metro names, not just IDs.

### 3. Added Read-Only Display for Existing Data
**File**: `src/components/business/place/PlaceLocationPicker.tsx`

Added a new section that displays district/metro data when:
- Location exists (lat/lng set)
- cityId is missing (so selects don't work)
- But district/metro IDs exist in database

Shows:
- "Район: {id} (автоматически)" or "(выбрано вручную)"
- "Метро: {id} · {distance} (автоматически)" or "(выбрано вручную)"

This makes existing data visible even when cityId is missing.

### 4. Added Console Warnings for Skipped Enrichment
**Files**: 
- `src/app/api/business/places/[id]/location/google/route.ts`
- `src/app/api/business/places/[id]/location/manual/route.ts`

Added console.warn when geo enrichment is skipped due to missing cityId:
```typescript
console.warn("[location/google] Geo enrichment SKIPPED: cityId is missing. TODO: Extract cityId from address_components in PlaceSearchInput.");
```

This helps developers understand why district/metro are not being auto-detected.

## What's Now Visible

### In Development Mode
1. **Debug panel** showing all geo data and why UI is/isn't rendering
2. **Console warnings** when geo enrichment is skipped

### For All Users
1. **Read-only display** of existing district/metro data (when cityId is missing but data exists)
2. **Full district/metro selects** (when cityId is present)

## What Still Needs to Be Done

### Implement cityId Extraction (Spec Created)
**Spec**: `.kiro/specs/place-location-cityid-extraction/`

The bugfix spec has been created with:
- Requirements document (bugfix.md)
- Design document (design.md)
- Implementation tasks (tasks.md)

**Summary**: PlaceSearchInput needs to:
1. Extract city name from Google Places address_components (type: "locality")
2. Look up cityId via new API endpoint `/api/geo/cities/lookup?name={cityName}&countryCode=BY`
3. Pass cityId in onPlaceSelect callback to PlaceLocationPicker
4. Enable automatic geo enrichment (district + metro detection)

## Files Changed

1. `src/components/business/place/PlaceLocationPicker.tsx` - Added debug panel + read-only display
2. `src/app/api/business/places/[id]/route.ts` - Added district/metro relations to GET response
3. `src/app/api/business/places/[id]/location/google/route.ts` - Added console warning
4. `src/app/api/business/places/[id]/location/manual/route.ts` - Added console warning

## Testing

1. Open Place Wizard in development mode
2. Navigate to Location step (Step 2)
3. Check debug panel at top - should show all geo data
4. Select address from Google autocomplete
5. Check console - should see warning about missing cityId
6. Check if district/metro UI renders (depends on cityId)
7. If data exists but cityId is missing, should see read-only display

## Next Steps

Execute the bugfix spec to implement cityId extraction:
```bash
# Review the spec
cat .kiro/specs/place-location-cityid-extraction/bugfix.md
cat .kiro/specs/place-location-cityid-extraction/design.md
cat .kiro/specs/place-location-cityid-extraction/tasks.md

# Implement the fix (follow tasks.md)
```

Once cityId extraction is implemented:
- Geo enrichment will run automatically
- District and metro will be auto-detected
- UI will render district/metro selects
- Users will see "Определено автоматически" instead of manual selection prompt
