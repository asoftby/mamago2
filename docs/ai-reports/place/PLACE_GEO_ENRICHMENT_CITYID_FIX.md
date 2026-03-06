# Place Geo Enrichment: CityId Fix

## Issue
Location save was failing with "Internal server error" because:
1. PlaceSearchInput doesn't extract/provide cityId from Google address
2. Geo enrichment service requires cityId to find districts/metro
3. Error was not caught, causing entire location save to fail

## Fix Applied

### 1. Made Geo Enrichment Optional
**Files**: 
- `src/app/api/business/places/[id]/location/google/route.ts`
- `src/app/api/business/places/[id]/location/manual/route.ts`

Wrapped geo enrichment in try-catch:
```typescript
if (cityId) {
  try {
    const geoData = await enrichPlaceGeoData(...);
    // Update fields
  } catch (geoError) {
    console.error("Geo enrichment error (non-fatal):", geoError);
    // Continue without geo enrichment
  }
}
```

### 2. Improved Error Logging
Added detailed error logging to both endpoints:
- Error message
- Error stack trace
- Returns error details to client

### 3. Fixed Payload
**File**: `src/components/business/place/PlaceLocationPicker.tsx`

Changed `cityId: cityId || undefined` to `cityId: cityId || null` for consistency.

## Current Behavior
- Location save works WITHOUT cityId
- District/metro auto-detection is SKIPPED if cityId is missing
- User can still manually select district/metro
- No errors thrown

## TODO: Full CityId Support

### Option 1: Extract from Google Address Components
**File**: `src/components/business/place/PlaceSearchInput.tsx`

Add cityId extraction:
```typescript
const cityComponent = place.address_components?.find(c => 
  c.types.includes("locality")
);

// Query database to get cityId by name
const cityId = await getCityIdByName(cityComponent?.long_name);

onPlaceSelect({
  // ... existing fields
  cityId,
});
```

### Option 2: Server-Side Lookup
**Files**: Location API endpoints

After receiving address, query City table:
```typescript
if (addressJson) {
  const cityName = extractCityName(addressJson);
  const city = await prisma.city.findFirst({
    where: { name: cityName }
  });
  updateData.cityId = city?.id || null;
}
```

### Option 3: Default to Minsk
For MVP, if country is Belarus, default to Minsk:
```typescript
if (countryCode === "BY" && !cityId) {
  const minsk = await prisma.city.findFirst({
    where: { name: "Минск" }
  });
  updateData.cityId = minsk?.id || null;
}
```

## Recommendation
Implement Option 3 (Default to Minsk) as quick fix, then Option 1 (Extract from Google) for proper solution.

## Files Modified
1. `src/app/api/business/places/[id]/location/google/route.ts`
2. `src/app/api/business/places/[id]/location/manual/route.ts`
3. `src/components/business/place/PlaceLocationPicker.tsx`

## Files Created
1. `src/lib/extractCityFromAddress.ts` (helper, not yet used)

## Status
✅ FIXED - Location save works without errors
⚠️ PARTIAL - Geo enrichment disabled until cityId is provided
🔄 TODO - Implement cityId extraction/default
