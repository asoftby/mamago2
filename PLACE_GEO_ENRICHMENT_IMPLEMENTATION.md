# Place Geo Enrichment Implementation

## Problem
Location step debug panel showed lat/lng present but `districtAutoId`, `metroAutoId`, and `metroAutoDistanceM` were always null. Geo enrichment was not running after lat/lng save.

## Solution
Created a new `PlaceGeoEnrichmentService` that enriches places by placeId without requiring cityId, and wired it to location save endpoints.

## Implementation

### A) Created PlaceGeoEnrichmentService
**File**: `src/services/place/placeGeoEnrichment.service.ts`

**Functions**:

1. **`computeDistrictAuto(lat, lng)`**
   - Returns `districtId` or `null`
   - Currently returns `null` (TODO: implement point-in-polygon when district boundaries are available)
   - Fallback could be nearest district centroid, but that's not accurate

2. **`computeMetroAuto(lat, lng)`**
   - Finds nearest MetroStation by Haversine distance
   - Returns `{ stationId, distanceM }` if within 3000m radius, else `null`
   - Searches all metro stations (fine for Belarus with limited stations)
   - In production with many cities, would filter by bounding box

3. **`enrichPlaceGeo(placeId)`**
   - Main function that enriches a place
   - Fetches place coordinates from database
   - Computes district and metro in parallel
   - Updates place with `districtAutoId`, `metroAutoId`, `metroAutoDistanceM`
   - **IMPORTANT**: Does NOT overwrite manual selections (`districtManualId`, `metroManualId`, `metroManualDistanceM`)
   - Returns updated place with all geo fields
   - Logs enrichment results for debugging

**Key differences from old service**:
- Works by `placeId` instead of requiring `cityId` parameter
- Handles database read and write internally
- No cityId requirement - searches all metro stations
- Returns full place object with all geo fields

### B) Wired Enrichment to Location Updates

**Files Modified**:
1. `src/app/api/business/places/[id]/location/google/route.ts`
2. `src/app/api/business/places/[id]/location/manual/route.ts`

**Changes**:
- Replaced import from `geoEnrichment.service` to `placeGeoEnrichment.service`
- Removed cityId-dependent enrichment logic
- After saving lat/lng, call `enrichPlaceGeo(placeId)`
- Return enriched place with all geo fields
- Enrichment errors are non-fatal (logged but don't break location save)

**Flow**:
```
User selects address or confirms pin
  ↓
POST /api/business/places/[id]/location/google (or /manual)
  ↓
Save lat/lng to database
  ↓
Call enrichPlaceGeo(placeId)
  ↓
  - Fetch place coordinates
  - Compute district (currently null)
  - Compute nearest metro within 3km
  - Update districtAutoId, metroAutoId, metroAutoDistanceM
  ↓
Return enriched place to client
  ↓
PlaceLocationPicker updates state
  ↓
Debug panel shows populated geo fields
```

### C) Updated Debug Panel
**File**: `src/components/business/place/PlaceLocationPicker.tsx`

**Changes**:
- Added `selectsVisible` flag (shows when location && cityId)
- Added `readOnlyVisible` flag (shows when location && !cityId && has geo data)
- Better visibility into why UI is/isn't rendering

### D) API Already Includes Geo Fields
**File**: `src/app/api/business/places/[id]/route.ts`

Already includes in previous fix:
- `districtAuto` relation
- `districtManual` relation
- `metroAuto` relation
- `metroManual` relation
- All distance fields

## Verification Steps

### 1. Start Development Server
```bash
pnpm dev
```

### 2. Open Place Wizard
- Navigate to business dashboard
- Create new place or edit existing place
- Go to Location step (Step 2)

### 3. Check Debug Panel (Yellow Box)
Before selecting location:
```json
{
  "lat": null,
  "lng": null,
  "cityId": null,
  "districtAutoId": null,
  "districtManualId": null,
  "metroAutoId": null,
  "metroAutoDistanceM": null,
  "metroManualId": null,
  "metroManualDistanceM": null,
  "selectsVisible": false,
  "readOnlyVisible": false
}
```

### 4. Select Address from Google Autocomplete
Example: "вулiца Камунiстычная 4, Мiнск"

After selection, debug panel should update:
```json
{
  "lat": 53.9045,
  "lng": 27.5615,
  "cityId": null,  // Still null (cityId extraction not implemented yet)
  "districtAutoId": null,  // Null (point-in-polygon not implemented)
  "districtManualId": null,
  "metroAutoId": "clxxx...",  // ✅ POPULATED with nearest metro station ID
  "metroAutoDistanceM": 850,  // ✅ POPULATED with distance in meters
  "metroManualId": null,
  "metroManualDistanceM": null,
  "selectsVisible": false,  // False (no cityId)
  "readOnlyVisible": true   // ✅ True (has geo data but no cityId)
}
```

### 5. Check Console Logs
Server console should show:
```
[placeGeoEnrichment] Enriched place clxxx...: {
  districtAutoId: null,
  metroAutoId: 'clxxx...',
  metroAutoDistanceM: 850
}
[location/google] Geo enrichment completed for place clxxx...
```

### 6. Check Read-Only Display
Below the map, should see:
```
Район и метро
Данные сохранены, но редактирование недоступно (отсутствует cityId)

Метро: clxxx... · 850 м (автоматически)
```

### 7. Test with Manual Pin
- Click "Выбрать точку на карте"
- Move pin to different location
- Click "Подтвердить"
- Debug panel should update with new metro data

## Expected Results

### ✅ Success Indicators
1. Debug panel shows `metroAutoId` and `metroAutoDistanceM` populated after location save
2. Console logs show enrichment completed
3. Read-only display shows metro data (when cityId is missing)
4. District remains null (expected - point-in-polygon not implemented)
5. Manual selections are NOT overwritten

### ❌ Failure Indicators
1. Debug panel shows all nulls after location save
2. Console shows "Place has no coordinates, skipping enrichment"
3. Console shows enrichment errors
4. No metro data visible in UI

## Known Limitations

### 1. District Detection Not Implemented
- `districtAutoId` will always be `null`
- Requires point-in-polygon algorithm with district boundary polygons
- User must select district manually

### 2. No CityId Extraction
- `cityId` remains `null` (PlaceSearchInput doesn't extract it)
- District/metro selects don't render (require cityId)
- Only read-only display is visible
- See spec: `.kiro/specs/place-location-cityid-extraction/` for fix

### 3. Metro Search Not City-Filtered
- Searches all metro stations in database
- Fine for Belarus (only Minsk has metro)
- For multiple cities, would need bounding box filter or cityId

## Files Changed

1. **NEW**: `src/services/place/placeGeoEnrichment.service.ts` - Geo enrichment service
2. **MODIFIED**: `src/app/api/business/places/[id]/location/google/route.ts` - Wired enrichment
3. **MODIFIED**: `src/app/api/business/places/[id]/location/manual/route.ts` - Wired enrichment
4. **MODIFIED**: `src/components/business/place/PlaceLocationPicker.tsx` - Updated debug panel

## Next Steps

### Immediate
1. Test enrichment with real addresses in Minsk
2. Verify metro stations exist in database
3. Check that distances are reasonable (< 3km)

### Future
1. Implement district point-in-polygon detection
2. Implement cityId extraction (see bugfix spec)
3. Add city-based filtering for metro search (when multiple cities have metro)
4. Consider caching metro stations in memory for performance

## Troubleshooting

### Metro Always Null
- Check if MetroStation table has data: `SELECT COUNT(*) FROM "MetroStation";`
- Check coordinates are in Belarus: lat ~53.9, lng ~27.5
- Check metro stations have correct coordinates
- Increase `METRO_SEARCH_RADIUS_METERS` temporarily to test

### Enrichment Not Running
- Check server console for errors
- Verify place has lat/lng saved
- Check API response includes enriched fields
- Verify enrichPlaceGeo is being called (add console.log)

### UI Not Updating
- Check PlaceLocationPicker receives updated place from API
- Verify state is being updated with new geo fields
- Check debug panel shows correct data
- Refresh page to reload place data
