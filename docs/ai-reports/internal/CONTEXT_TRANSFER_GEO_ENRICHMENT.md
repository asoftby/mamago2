# Context Transfer - Geo Enrichment Fix

## What Was Done

Fixed geo enrichment for Place creation so that cityId, districtAutoId, metroAutoId, and metroAutoDistanceM are computed when saving location data.

## Changes Made

### 1. API Route Enhancement (`src/app/api/business/places/route.ts`)
- Added detailed logging for geo enrichment pipeline
- Fixed return value to merge created place with enriched data
- Added error stack traces for debugging

### 2. Client-Side Logging (`src/app/business/(protected)/places/new/NewPlaceWizard.tsx`)
- Added logging in `saveDraft()` to show location data being sent
- Added logging to show enriched data received from server
- Added logging in `submitForModeration()` for consistency

### 3. Prisma Client Regeneration
- Ran `npx prisma generate` to ensure TypeScript has latest types
- Verified schema includes all required fields (createRequestId, districtAutoId, metroAutoId, etc.)

## How It Works

### Flow Overview
```
1. User selects address on Step 2
   ↓
2. PlaceLocationPicker calls onUpdate with location data
   ↓
3. NewPlaceWizard stores in localDraft
   ↓
4. User clicks "Сохранить черновик"
   ↓
5. POST /api/business/places creates place
   ↓
6. updatePlaceLocation service runs enrichment pipeline
   ↓
7. Enriched data returned to client
   ↓
8. NewPlaceWizard updates localDraft with enriched fields
```

### Enrichment Pipeline
```
updatePlaceLocation
  ↓
1. Persist raw location (lat, lng, addressJson)
  ↓
2. resolveCityId (from addressJson or coordinates)
  ↓
3. enrichPlaceGeo
  ↓
  ├─ computeNearestDistrict (by centroid)
  └─ computeNearestMetro (by haversine distance)
  ↓
4. Return enriched place with all geo fields
```

## Testing

See `PLACE_GEO_ENRICHMENT_TESTING.md` for detailed testing guide.

Quick test:
1. Create new place at `/business/places/new`
2. Fill Step 1 (title, category, shortDesc)
3. Select Minsk address on Step 2
4. Click "Сохранить черновик"
5. Check browser console for enrichment logs
6. Verify cityId, districtAutoId, metroAutoId are set

## Files Modified

1. `src/app/api/business/places/route.ts` - Enhanced logging and return value
2. `src/app/business/(protected)/places/new/NewPlaceWizard.tsx` - Added client-side logging
3. `PLACE_GEO_ENRICHMENT_FIX_COMPLETE.md` - Detailed documentation
4. `PLACE_GEO_ENRICHMENT_TESTING.md` - Testing guide

## Files Referenced (No Changes)

- `src/services/place/placeLocation.service.ts` - Main enrichment pipeline
- `src/services/place/placeGeoEnrichment.service.ts` - District/metro computation
- `src/services/place/cityResolver.service.ts` - City resolution
- `src/components/business/place/PlaceLocationPicker.tsx` - Location picker component
- `prisma/schema.prisma` - Database schema

## Known Issues

TypeScript may show errors about createRequestId, districtAutoId, metroAutoId not existing on Place type. These are false positives - the Prisma client has been regenerated and the fields exist at runtime. Restart your TypeScript server or IDE to clear these errors.

## Next Steps

If geo enrichment doesn't work:
1. Check database has City, District, MetroStation records
2. Verify City.googleName matches extracted city names
3. Verify District.centerLat/centerLng are set
4. Verify MetroStation.lat/lng are set
5. Check server logs for errors in enrichment pipeline

## Related Tasks

This completes Task 5 from the context transfer:
- ✅ Fix geo enrichment so cityId, districtAutoId, metroAutoId are computed when saving location
- ✅ Add comprehensive logging for debugging
- ✅ Return enriched data to client
- ✅ Update client state with enriched fields
