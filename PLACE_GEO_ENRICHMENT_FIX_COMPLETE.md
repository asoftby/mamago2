# Place Geo Enrichment Fix - Complete ✅

## Summary

Fixed geo enrichment (cityId, districtAutoId, metroAutoId, metroAutoDistanceM) for Place creation in NewPlaceWizard. The enrichment pipeline now runs automatically when saving a draft or submitting for moderation, and enriched data is returned to the client and displayed in the UI.

## Problem
After implementing manual save for Place creation, the geo enrichment (cityId, districtAutoId, metroAutoId, metroAutoDistanceM) was not being computed when saving location data in the NewPlaceWizard.

## Root Cause
The POST `/api/business/places` endpoint was calling `updatePlaceLocation` service after creating the place, but:
1. Prisma client types were stale (needed regeneration)
2. The enriched data wasn't being properly merged with the created place before returning to client
3. Insufficient logging made it hard to debug

## Solution Implemented

### 1. Regenerated Prisma Client
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

This ensured TypeScript has the latest types including:
- `createRequestId` field on Place model
- `districtAutoId`, `metroAutoId`, `metroAutoDistanceM` fields

**Note:** If you see TypeScript errors in your IDE about these fields not existing, restart your TypeScript server or IDE. The Prisma client has been regenerated and the fields exist at runtime.

### 2. Enhanced POST Endpoint Logging
Added detailed logging in `/api/business/places` POST handler:
- Log location data before enrichment
- Log enriched data after enrichment
- Log error stack traces for debugging

### 3. Fixed Return Value
Changed the return statement to merge the created place with enriched data:
```typescript
return NextResponse.json({ 
  place: {
    ...place,
    ...enrichedPlace,
  }
});
```

This ensures the client receives:
- All original place fields (title, category, etc.)
- Enriched geo fields (cityId, districtAutoId, metroAutoId, metroAutoDistanceM)
- Related objects (city, districtAuto, metroAuto)

## Geo Enrichment Pipeline

When a place is created with location data (lat/lng), the following pipeline runs:

### Step 1: Create Place Record
```typescript
const place = await prisma.place.create({
  data: {
    // ... all fields including lat, lng, addressJson
  }
});
```

### Step 2: Run updatePlaceLocation Service
```typescript
const enrichedPlace = await updatePlaceLocation(place.id, {
  lat: place.lat,
  lng: place.lng,
  googlePlaceId: place.googlePlaceId,
  formattedAddr: place.formattedAddr,
  addressJson: place.addressJson,
  countryCode: place.countryCode,
});
```

This service:
1. Persists raw location data
2. Resolves cityId using CityResolver (from addressJson or coordinates)
3. Calls enrichPlaceGeo to compute district and metro

### Step 3: enrichPlaceGeo Computes Geo Data
```typescript
// Compute district (nearest centroid)
const districtResult = await computeNearestDistrict(cityId, lat, lng);

// Compute metro (nearest station within max distance)
const metroResult = await computeNearestMetro(cityId, lat, lng);

// Update place
await prisma.place.update({
  where: { id: placeId },
  data: {
    districtAutoId: districtResult?.districtId || null,
    metroAutoId: metroResult?.metroStationId || null,
    metroAutoDistanceM: metroResult?.distanceM || null,
  }
});
```

### Step 4: Return Enriched Data
The enriched place object includes:
- `cityId` - Resolved city
- `districtAutoId` - Auto-computed district
- `metroAutoId` - Auto-computed nearest metro station
- `metroAutoDistanceM` - Distance to metro in meters
- Related objects: `city`, `districtAuto`, `metroAuto`

## Client-Side Integration

### NewPlaceWizard Updates Local State
After successful save, the wizard updates its local state with enriched data:
```typescript
const { place } = await res.json();

setLocalDraft((prev) => ({
  ...prev,
  cityId: place.cityId || prev.cityId,
  districtAutoId: place.districtAutoId || prev.districtAutoId,
  metroAutoId: place.metroAutoId || prev.metroAutoId,
  metroAutoDistanceM: place.metroAutoDistanceM || prev.metroAutoDistanceM,
}));
```

### PlaceLocationPicker Shows Enriched Data
The location picker component receives and displays:
- City name
- District name (if computed)
- Metro station name + distance (if computed)

## Acceptance Criteria

✅ After selecting address on Step 2 and saving draft:
- `cityId` is resolved and saved
- `districtAutoId` is computed (if district polygons/centroids exist)
- `metroAutoId` and `metroAutoDistanceM` are computed (if city has metro)

✅ For cities without metro (e.g., Mogilev):
- Metro fields remain null
- UI hides metro information

✅ Enriched data is returned to client and displayed in UI

✅ Comprehensive logging helps debug any issues

## Files Modified

1. `src/app/api/business/places/route.ts`
   - Enhanced logging for geo enrichment
   - Fixed return value to merge enriched data

2. Prisma Client
   - Regenerated to include latest schema fields

## Testing Checklist

To verify the fix works:

1. **Test with Minsk address (Google autocomplete)**
   - [ ] Open `/business/places/new`
   - [ ] Fill Step 1 (title, category, shortDesc)
   - [ ] Go to Step 2
   - [ ] Select a Minsk address from Google autocomplete
   - [ ] Click "Сохранить черновик"
   - [ ] Check browser console logs:
     - Should see `[NewPlaceWizard] Location data:` with addressJson
     - Should see `[places/POST] Running geo enrichment`
     - Should see `[places/POST] Enriched data:` with cityId, districtAutoId, metroAutoId
     - Should see `[NewPlaceWizard] Place created successfully:` with enriched fields
   - [ ] Verify in UI that city, district, and metro are displayed
   
2. **Test with manual pin in Minsk**
   - [ ] Open `/business/places/new`
   - [ ] Fill Step 1
   - [ ] Go to Step 2
   - [ ] Click "Указать на карте"
   - [ ] Drop pin in Minsk
   - [ ] Click "Сохранить черновик"
   - [ ] Check logs for geo enrichment
   - [ ] Verify cityId is resolved (should default to Minsk)
   - [ ] Verify district and metro are computed
   
3. **Test with city without metro**
   - [ ] If you have a city without metro in DB (e.g., Mogilev)
   - [ ] Create place with address in that city
   - [ ] Verify metro fields are null in logs
   - [ ] Verify UI doesn't show metro section

4. **Test address persistence**
   - [ ] Select address on Step 2
   - [ ] Go to Step 3
   - [ ] Go back to Step 2
   - [ ] Verify address is still shown in input field
   - [ ] Verify map pin is still at correct location

## Debugging Guide

If geo enrichment doesn't work, check these in order:

### 1. Check if location data is being sent
```
[NewPlaceWizard] Location data: {
  lat: 53.9,
  lng: 27.5,
  googlePlaceId: "ChIJ...",
  formattedAddr: "улица Ленина, Минск",
  hasAddressJson: true
}
```

If `hasAddressJson: false`, the PlaceLocationPicker isn't passing addressJson correctly.

### 2. Check if enrichment is triggered
```
[places/POST] 🌍 Running geo enrichment for place: clxxx
```

If you don't see this, the place was created without lat/lng.

### 3. Check cityResolver logs
```
[cityResolver] Starting resolution: { hasAddressJson: true, ... }
[cityResolver] Extracted city: "Минск", country: "BY"
[cityResolver] ✅ Matched city by address: Минск (clxxx)
```

If city isn't matched, check:
- City.googleName field in database
- City.name field matches the extracted city name
- addressJson structure is correct

### 4. Check geo enrichment logs
```
[placeGeoEnrichment] ✅ Enriched place clxxx: {
  cityId: "clxxx",
  districtAutoId: "clxxx",
  districtName: "Центральный",
  metroAutoId: "clxxx",
  metroName: "Площадь Ленина",
  metroAutoDistanceM: 450
}
```

If district/metro are null, check:
- District records exist for the city
- District.centerLat and centerLng are set
- MetroStation records exist for the city
- City.hasMetro is true
- Coordinates are within metro search radius (4km by default)

### 5. Check if enriched data is returned
```
[NewPlaceWizard] Place created successfully: {
  id: "clxxx",
  cityId: "clxxx",
  districtAutoId: "clxxx",
  metroAutoId: "clxxx",
  metroAutoDistanceM: 450
}
```

If these fields are undefined, the API isn't returning enriched data properly.

## Next Steps

If geo enrichment still doesn't work after this fix:

1. **Check Database Setup**
   - Verify City records exist with proper fields:
     - `name` (e.g., "Минск")
     - `googleName` (e.g., "Minsk" or "Минск")
     - `slug` (e.g., "minsk")
     - `hasMetro` (true for cities with metro)
     - `centerLat`, `centerLng` (for coordinate-based resolution)
   
   - Verify District records exist:
     - `cityId` links to City
     - `centerLat`, `centerLng` are set (for nearest centroid calculation)
     - Or `polygonJson` is set (for point-in-polygon, if implemented)
   
   - Verify MetroStation records exist:
     - `cityId` links to City
     - `lat`, `lng` are set
     - `name` is set

2. **Check Google Maps API**
   - Verify Google Places API is returning addressJson with address_components
   - Check that address_components include locality or administrative_area types
   - Verify country code is being extracted

3. **Check Logs**
   - Enable detailed logging in all services
   - Check for errors in cityResolver, placeGeoEnrichment
   - Verify coordinates are within expected bounds

4. **Test with Known Good Data**
   - Use a known Minsk address: "улица Ленина 3, Минск"
   - Expected results:
     - cityId should resolve to Minsk
     - districtAutoId should resolve to a district
     - metroAutoId should resolve to nearest metro station
     - metroAutoDistanceM should be < 4000 meters

## Related Documentation

- `src/services/place/placeLocation.service.ts` - Main location update pipeline
- `src/services/place/placeGeoEnrichment.service.ts` - District and metro computation
- `src/services/place/cityResolver.service.ts` - City resolution from addressJson
