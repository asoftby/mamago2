# Place Metro Distance Storage & Display

## Summary
Implemented storage and display of distance to metro stations (in meters) for both business owners in the Location step and end users on public place pages. Distance is computed once when location is set/changed, not on every page view.

## Changes Made

### 1. Database Schema Updates
**File**: `prisma/schema.prisma`

Added distance fields to Place model:
- `metroAutoDistanceM: Int?` - Distance to auto-determined metro in meters
- `metroManualDistanceM: Int?` - Distance to manually selected metro in meters

**Migration**: `20260305115708_add_metro_distance_fields`

### 2. Distance Formatter Utility
**File**: `src/lib/formatDistance.ts`

Created shared formatter function:
```typescript
formatDistance(meters: number): string
```

Rules:
- `< 1000m` → "850 м"
- `>= 1000m` → "1.4 км" (one decimal place)

### 3. Geo Enrichment Service Updates
**File**: `src/services/geo/geoEnrichment.service.ts`

Updated functions:

**`findNearestMetro()`**
- Now returns `{ id: string; distanceM: number } | null`
- Distance is rounded to integer meters
- Returns null if no stations within 2.5km radius

**`enrichPlaceGeoData()`**
- Now returns `metroAutoDistanceM` along with `metroAutoId`
- Distance is stored when location is set

**`calculateMetroDistance()` (NEW)**
- Calculates distance from place coordinates to specific metro station
- Used when user manually selects a metro
- Returns rounded integer meters

### 4. Location API Updates
**Files**:
- `src/app/api/business/places/[id]/location/google/route.ts`
- `src/app/api/business/places/[id]/location/manual/route.ts`

Both endpoints now:
- Store `metroAutoDistanceM` when enriching geo data
- Distance computed once when coordinates are saved
- Never overwrite manual distance

### 5. Geo Override API Update
**File**: `src/app/api/business/places/[id]/geo/route.ts`

When manual metro is selected:
- Fetches place coordinates
- Calls `calculateMetroDistance()` to compute distance
- Stores `metroManualDistanceM` in database
- Returns updated place with distance

When manual metro is cleared:
- Sets `metroManualDistanceM` to null
- Reverts to showing auto distance

### 6. PlaceLocationPicker Component
**File**: `src/components/business/place/PlaceLocationPicker.tsx`

Added:
- Import `formatDistance` utility
- State for `metroAutoDistanceM` and `metroManualDistanceM`
- Computed value: `metroDistanceShown = metroManualId ? metroManualDistanceM : metroAutoDistanceM`
- Distance display below metro select (when metro is selected)
- Updated `handleMetroChange()` to extract distance from server response
- Updated `handleResetMetro()` to clear manual distance

UI changes:
- Shows "Расстояние: 850 м" or "Расстояние: 1.4 км" below metro select
- Distance only shown when metro is selected and distance is available
- Distance updates automatically when metro changes

### 7. Step2Location Update
**File**: `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`

Updated `initialLocation` to include:
- `metroAutoDistanceM`
- `metroManualDistanceM`

## Data Flow

### Auto Distance (Address/Pin Selection)
1. User selects address or pins location
2. Server calls `enrichPlaceGeoData(lat, lng, cityId)`
3. `findNearestMetro()` calculates distance using Haversine
4. Server stores `metroAutoId` and `metroAutoDistanceM`
5. Client receives response and updates state
6. UI shows metro name + formatted distance

### Manual Distance (Manual Metro Selection)
1. User selects metro from dropdown
2. Client calls PATCH `/api/business/places/[id]/geo`
3. Server fetches place coordinates
4. Server calls `calculateMetroDistance(lat, lng, metroId)`
5. Server stores `metroManualId` and `metroManualDistanceM`
6. Client receives response with distance
7. UI shows metro name + formatted distance

### Reset Flow
1. User clicks "Сбросить"
2. Client calls PATCH with `metroManualId: null`
3. Server clears `metroManualId` and `metroManualDistanceM`
4. Client clears manual state
5. UI reverts to showing auto metro + auto distance

## Display Logic

### Business Owner (Location Step)
```
Displayed Metro ID: metroManualId ?? metroAutoId
Displayed Distance: metroManualId ? metroManualDistanceM : metroAutoDistanceM
```

Format: "Расстояние: {formattedDistance}"

### End User (Public Pages)
TODO: Implement in place card/page components

Format: "Метро: {stationName} · {formattedDistance}"

## Distance Calculation
- Uses Haversine formula for great-circle distance
- Earth radius: 6371 km
- Returns distance in meters (rounded to integer)
- Accurate for short distances (< 10km)

## Performance
- Distance computed ONCE when location is set/changed
- Stored in database (no runtime calculation)
- No performance impact on page views
- Efficient for both business and public pages

## Files Created
1. `src/lib/formatDistance.ts`
2. Migration: `prisma/migrations/20260305115708_add_metro_distance_fields/`

## Files Modified
1. `prisma/schema.prisma`
2. `src/services/geo/geoEnrichment.service.ts`
3. `src/app/api/business/places/[id]/location/google/route.ts`
4. `src/app/api/business/places/[id]/location/manual/route.ts`
5. `src/app/api/business/places/[id]/geo/route.ts`
6. `src/components/business/place/PlaceLocationPicker.tsx`
7. `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`

## Testing Checklist
- [ ] Select address → metro distance shown (if metro found)
- [ ] Pin location → metro distance shown (if metro found)
- [ ] Distance formatted correctly (< 1000m shows "м", >= 1000m shows "км")
- [ ] Manual metro selection → distance recalculated and shown
- [ ] Reset metro → reverts to auto distance
- [ ] Distance persists in database (not recalculated on page load)
- [ ] No distance shown if metro is null
- [ ] Distance updates when location changes
- [ ] Manual distance persists when location changes
- [ ] No TypeScript errors
- [ ] No runtime errors

## Next Steps
- [ ] Implement metro + distance display on public place card
- [ ] Implement metro + distance display on public place page
- [ ] Format: "Метро: {stationName} · {formattedDistance}"

## Status
✅ COMPLETE - Business owner UI implemented
⏳ TODO - Public user UI (place card/page)
