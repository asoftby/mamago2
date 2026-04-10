# Place Geo Enrichment MVP - Complete Implementation

## Overview
Implemented automatic geo enrichment for Place locations with district (centroid-based) and metro (Haversine distance) detection. Enrichment runs automatically whenever place coordinates change.

## What Was Implemented

### 1. Database Schema Changes
**File**: `prisma/schema.prisma`

Added centroid fields to District model:
```prisma
model District {
  centerLat Float? // Centroid latitude for MVP geo enrichment
  centerLng Float? // Centroid longitude for MVP geo enrichment
}
```

Place model already had required fields:
- `cityId` - City reference
- `districtAutoId` - Auto-detected district
- `metroAutoId` - Auto-detected metro station
- `metroAutoDistanceM` - Distance to metro in meters

**Migration**: `20260305124539_add_district_centroids`

### 2. Geo Enrichment Service
**File**: `src/services/place/placeGeoEnrichment.service.ts`

**Functions**:

1. **`haversineMeters(lat1, lng1, lat2, lng2)`**
   - Pure distance calculation using Haversine formula
   - Returns distance in meters
   - Earth radius: 6371 km

2. **`resolveCityId(placeCityId)`**
   - MVP logic for determining cityId:
     - If place has cityId, use it
     - Else if only one city in DB, use it
     - Else try to find Minsk by slug
     - Else return null
   - Logs fallback decisions for debugging

3. **`computeNearestMetro(cityId, lat, lng)`**
   - Finds nearest metro station within 4km radius
   - Returns `{ metroStationId, distanceM }` or null
   - Filters by cityId for performance
   - Logs when no station found within radius

4. **`computeNearestDistrict(cityId, lat, lng)`**
   - Finds nearest district by centroid (MVP approximation)
   - Returns `{ districtId }` or null
   - Only considers districts with centerLat/centerLng
   - No radius limit (always returns nearest)

5. **`enrichPlaceGeo(placeId)`** - Main function
   - Fetches place coordinates and cityId
   - Clears auto fields if no coordinates
   - Resolves cityId using fallback logic
   - Updates place.cityId if resolved from fallback
   - Computes district and metro in parallel
   - Updates districtAutoId, metroAutoId, metroAutoDistanceM
   - **NEVER overwrites manual selections**
   - Returns enriched place with relations
   - Comprehensive logging for debugging

**Constants**:
- `METRO_SEARCH_RADIUS_METERS = 4000` (4km, forgiving for Minsk)
- `EARTH_RADIUS_KM = 6371`

### 3. Wired to Location APIs
**Files**:
- `src/app/api/business/places/[id]/location/google/route.ts`
- `src/app/api/business/places/[id]/location/manual/route.ts`

**Changes**:
- After saving lat/lng, call `enrichPlaceGeo(placeId)`
- Return enriched place with all geo fields and relations
- Enrichment errors are non-fatal (logged but don't break location save)
- Removed cityId requirement (service handles fallback)

### 4. District Centroids Seed Script
**File**: `prisma/seed/district-centroids.ts`

**Features**:
- Seeds 9 Minsk districts with approximate centroids
- Updates existing districts or creates new ones
- Validates Minsk city exists before seeding
- Comprehensive logging and summary
- Idempotent (can run multiple times safely)

**Districts seeded**:
1. Центральный (53.9006, 27.5590)
2. Советский (53.9200, 27.6100)
3. Первомайский (53.8900, 27.6200)
4. Партизанский (53.8700, 27.6400)
5. Заводской (53.8800, 27.4800)
6. Ленинский (53.8500, 27.5300)
7. Октябрьский (53.9100, 27.4800)
8. Московский (53.9400, 27.6700)
9. Фрунзенский (53.8500, 27.6000)

**Usage**: `npx tsx prisma/seed/district-centroids.ts`

### 5. UI Display in Location Step
**File**: `src/components/business/place/PlaceLocationPicker.tsx`

**Added read-only display** (blue box):
- Shows when location exists and district/metro are enriched
- Displays district name (from relation)
- Displays metro name + formatted distance
- Shows hint when no data: "Метро/район определим после выбора точки"
- Always visible when enrichment data exists

**Updated debug panel**:
- Added `selectsVisible` flag
- Added `readOnlyVisible` flag
- Shows cityId resolution status

**Distance formatting**: Uses existing `formatDistance()` utility
- < 1000m: "850 м"
- >= 1000m: "1.4 км" (1 decimal)

### 6. Test Script
**File**: `scripts/manual-tests/test-place-geo-enrichment.ts`

**Features**:
- Finds place with coordinates
- Runs enrichment
- Shows before/after comparison
- Displays metro station details
- Displays district details
- Shows total metro stations count

**Usage**: `npx tsx scripts/manual-tests/test-place-geo-enrichment.ts`

## How It Works

### Data Flow
```
User selects address or confirms pin
  ↓
POST /api/business/places/[id]/location/google (or /manual)
  ↓
Save lat/lng to database
  ↓
Call enrichPlaceGeo(placeId)
  ↓
  1. Fetch place (lat, lng, cityId)
  2. Resolve cityId (use existing or fallback to Minsk)
  3. Update place.cityId if resolved
  4. Compute nearest district centroid (parallel)
  5. Compute nearest metro within 4km (parallel)
  6. Update districtAutoId, metroAutoId, metroAutoDistanceM
  ↓
Return enriched place with relations
  ↓
PlaceLocationPicker updates state
  ↓
UI shows blue box with district and metro
  ↓
Debug panel shows populated geo fields
```

### CityId Resolution Logic
1. If `place.cityId` exists → use it
2. Else if only 1 city in DB → use it (log: "Using single city")
3. Else find city with slug "minsk" → use it (log: "Defaulting to Minsk")
4. Else → return null (log: "Could not resolve cityId")

### Metro Detection
- Query all metro stations for resolved cityId
- Calculate Haversine distance to each station
- Find nearest station within 4km radius
- If found: set metroAutoId and metroAutoDistanceM
- If not found: set both to null (log: "No metro station within 4000m")

### District Detection (MVP)
- Query all districts with centerLat/centerLng for resolved cityId
- Calculate Haversine distance to each district centroid
- Find nearest district (no radius limit)
- Set districtAutoId
- If no districts have centroids: set to null (log: "No districts with centroids found")

## Verification Steps

### 1. Check Database Migration
```bash
npx prisma migrate status
```
Should show: `20260305124539_add_district_centroids` applied

### 2. Verify District Centroids
```bash
npx tsx prisma/seed/district-centroids.ts
```
Should show: "✅ Districts with centroids: 9/9"

### 3. Test Enrichment
```bash
npx tsx scripts/manual-tests/test-place-geo-enrichment.ts
```
Should show:
- District (after): [district-id]
- Metro (after): [metro-id]
- Distance (after): [meters] meters

### 4. Test in UI
1. Start dev server: `pnpm dev`
2. Open Place Wizard → Location step
3. Select address from Google autocomplete (e.g., "вулiца Камунiстычная 4, Мiнск")
4. Check debug panel (yellow box):
   ```json
   {
     "districtAutoId": "cmmap1t1e0013wsa4im3m5lhh",
     "metroAutoId": "cmmbq9efl000uws84regajxpp",
     "metroAutoDistanceM": 911
   }
   ```
5. Check blue box below map:
   ```
   📍 Определено автоматически
   Район: Центральный
   Метро: Фрунзенская · 911 м
   ```

### 5. Check Server Logs
Should see:
```
[placeGeoEnrichment] Using single city: cmmap1t160011wsa4n1f0ymz1
[placeGeoEnrichment] ✅ Enriched place cmmckofrp0001wso7ggnisr26: {
  cityId: 'cmmap1t160011wsa4n1f0ymz1',
  districtAutoId: 'cmmap1t1e0013wsa4im3m5lhh',
  districtName: 'Центральный',
  metroAutoId: 'cmmbq9efl000uws84regajxpp',
  metroName: 'Фрунзенская',
  metroAutoDistanceM: 911
}
[location/google] Geo enrichment completed for place cmmckofrp0001wso7ggnisr26
```

## Test Results

### Actual Test Run
```
🧪 Testing Place Geo Enrichment

📍 Found place:
   ID: cmmckofrp0001wso7ggnisr26
   Title: Новое место
   Coordinates: 53.913342, 27.542247
   District (before): null
   Metro (before): null
   Distance (before): null

🔄 Running geo enrichment...

✅ Enrichment completed:
   District (after): cmmap1t1e0013wsa4im3m5lhh
   Metro (after): cmmbq9efl000uws84regajxpp
   Distance (after): 911 meters

🚇 Nearest metro station:
   Name: Фрунзенская
   Coordinates: 53.9053364, 27.5393148
   Distance: 911m

🏘️  District:
   Name: Центральный

📊 Total metro stations in database: 36
```

**Result**: ✅ All enrichment working correctly!

## Files Changed

### New Files
1. `prisma/seed/district-centroids.ts` - District centroids seed script
2. `scripts/manual-tests/test-place-geo-enrichment.ts` - Test script

### Modified Files
1. `prisma/schema.prisma` - Added centerLat/centerLng to District
2. `src/services/place/placeGeoEnrichment.service.ts` - Complete rewrite with district centroid support
3. `src/app/api/business/places/[id]/location/google/route.ts` - Simplified enrichment call
4. `src/app/api/business/places/[id]/location/manual/route.ts` - Simplified enrichment call
5. `src/components/business/place/PlaceLocationPicker.tsx` - Added blue box display

### Database
1. Migration: `prisma/migrations/20260305124539_add_district_centroids/migration.sql`

## Acceptance Checklist

✅ **1. After selecting address or confirming pin:**
- Place has metroAutoId (not null) for Minsk coordinates near metro
- Place has metroAutoDistanceM with distance in meters
- Place has districtAutoId (not null) after centroids seeded

✅ **2. District centroids seeded:**
- 9 Minsk districts have centerLat/centerLng
- Seed script is idempotent and can run multiple times

✅ **3. Business Location step shows enriched data:**
- Blue box displays district name
- Blue box displays metro name + formatted distance
- Shows hint when no data available

✅ **4. Debug panel updates:**
- Shows districtAutoId, metroAutoId, metroAutoDistanceM
- Shows selectsVisible and readOnlyVisible flags
- Shows cityId resolution status

✅ **5. No Google API calls added:**
- All enrichment uses local database
- Haversine distance calculation is pure function
- No external API dependencies

## Known Limitations

### 1. District Detection is Approximate
- Uses nearest centroid, not point-in-polygon
- Accuracy depends on centroid placement
- Can be improved later with actual district polygons

### 2. CityId Fallback Logic
- Defaults to Minsk for MVP
- Works for single-city deployment
- Multi-city support requires cityId extraction from Google Places

### 3. Metro Radius
- 4km radius is forgiving but may include distant stations
- Can be adjusted via `METRO_SEARCH_RADIUS_METERS` constant

### 4. Manual Overrides Not Implemented
- Only auto fields are computed
- Manual selection UI requires cityId (not implemented yet)
- See spec: `.kiro/specs/place-location-cityid-extraction/`

## Future Improvements

### Short Term
1. Implement cityId extraction from Google Places address_components
2. Add manual override UI for district and metro
3. Refine district centroids with more accurate coordinates

### Long Term
1. Implement point-in-polygon for district detection
2. Add district boundary polygons to database
3. Support multiple cities with proper cityId handling
4. Add caching for metro stations (in-memory)
5. Add bounding box filtering for metro search (performance)

## Troubleshooting

### Metro Always Null
**Check**:
1. Metro stations exist: `SELECT COUNT(*) FROM "MetroStation";`
2. Coordinates are in Minsk: lat ~53.9, lng ~27.5
3. Distance is within 4km radius
4. CityId is resolved correctly

**Fix**:
- Increase `METRO_SEARCH_RADIUS_METERS` temporarily
- Check metro station coordinates are correct
- Verify cityId resolution in logs

### District Always Null
**Check**:
1. District centroids seeded: `SELECT COUNT(*) FROM "District" WHERE "centerLat" IS NOT NULL;`
2. Should return 9 for Minsk

**Fix**:
- Run seed script: `npx tsx prisma/seed/district-centroids.ts`
- Check Minsk city exists in database
- Verify district names match exactly

### Enrichment Not Running
**Check**:
1. Server console for errors
2. Place has lat/lng saved
3. API response includes enriched fields

**Fix**:
- Check `enrichPlaceGeo` is being called (add console.log)
- Verify location APIs are calling enrichment
- Check database connection

### UI Not Updating
**Check**:
1. PlaceLocationPicker receives updated place from API
2. State is being updated with new geo fields
3. Debug panel shows correct data

**Fix**:
- Refresh page to reload place data
- Check API response includes relations (districtAuto, metroAuto)
- Verify blue box conditional logic

## Summary

MVP geo enrichment is complete and working:
- ✅ District detection via centroid approximation
- ✅ Metro detection via Haversine distance (4km radius)
- ✅ Automatic enrichment on location save
- ✅ CityId resolution with Minsk fallback
- ✅ UI display in Location step
- ✅ Comprehensive logging and debugging
- ✅ Test scripts for verification
- ✅ No external API dependencies

The system is ready for production use in Minsk. Future improvements can add point-in-polygon for districts and cityId extraction for multi-city support.
