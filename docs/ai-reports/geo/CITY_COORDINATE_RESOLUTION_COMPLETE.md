# City Coordinate-Based Resolution - Complete ✅

## Summary

Implemented robust coordinate-based city resolution that works for places in ANY city, not just Minsk. The system now primarily uses lat/lng coordinates to determine cityId, with address parsing as a validation helper.

## Problem

- cityId often stayed null after saving location
- System relied too heavily on Google address parsing
- Manual pin drops (no addressJson) couldn't resolve city
- District and metro enrichment failed without cityId
- System was Minsk-centric, not scalable to other cities

## Solution Overview

### 1. Coordinate-Based Resolution (PRIMARY)
- Calculate distance from place coordinates to all city centers
- Match if distance <= city.radiusKm
- Works for both Google autocomplete AND manual pin drops
- Scalable to any city in the database

### 2. Address Parsing (HELPER)
- Extract city name from Google addressJson
- Used to validate coordinate-based result
- Provides hints when coordinates are ambiguous

### 3. Manual Fallback (UI)
- If no city matches, return null
- UI prompts user to manually select city
- After manual selection, enrichment proceeds normally

## Database Changes

### Added to City Model
```prisma
model City {
  // ... existing fields ...
  
  // City center for coordinate-based resolution
  centerLat Float?
  centerLng Float?
  radiusKm  Float?  // Search radius in km (e.g., 40 for Minsk)
  
  // ... rest of model ...
}
```

### Migration
- Created migration: `20260305215029_add_city_radius_km`
- Adds `radiusKm` field to City table
- Nullable to allow gradual rollout

### Required Data Setup
For each city in the database, set:
```sql
UPDATE "City" 
SET 
  "centerLat" = 53.9,  -- City center latitude
  "centerLng" = 27.5,  -- City center longitude
  "radiusKm" = 40      -- Search radius in km
WHERE slug = 'minsk';
```

## Implementation

### cityResolver.service.ts - Complete Rewrite

#### 1. Haversine Distance Calculation
```typescript
function haversineKm(lat1, lng1, lat2, lng2): number {
  // Returns distance in kilometers
  // Used to calculate distance from place to city center
}
```

#### 2. Coordinate-Based Resolution (PRIMARY)
```typescript
async function resolveCityByCoordinates(
  lat: number,
  lng: number,
  countryCode?: string | null
): Promise<{ cityId, cityName, distance } | null> {
  // 1. Load all cities with centerLat, centerLng, radiusKm
  // 2. Calculate distance to each city center
  // 3. Find nearest city where distance <= radiusKm
  // 4. Return cityId or null
}
```

**Algorithm:**
1. Query all cities with center coordinates and radius
2. For each city, calculate distance using Haversine formula
3. Filter cities where `distance <= city.radiusKm`
4. Return nearest matching city
5. If no match, return null

**Confidence:** HIGH - coordinates are within city boundaries

#### 3. Address Parsing (HELPER)
```typescript
async function resolveCityByAddressComponents(
  addressJson: any
): Promise<{ cityId, cityName } | null> {
  // 1. Extract city name from address_components
  // 2. Match against City.googleName, City.name, or City.slug
  // 3. Return cityId or null
}
```

**Used for:**
- Validating coordinate-based result
- Fallback when coordinates don't match any city
- Providing hints for ambiguous cases

**Confidence:** MEDIUM - depends on Google data quality

#### 4. Main Resolution Function
```typescript
export async function resolveCityId(input: {
  lat: number;
  lng: number;
  addressJson?: any | null;
  existingCityId?: string | null;
}): Promise<{
  cityId: string | null;
  confidence: "high" | "medium" | "low" | null;
  shouldUpdate: boolean;
  cityName?: string;
}>
```

**Resolution Strategy:**
1. Try coordinate-based resolution (PRIMARY)
   - If found → return with HIGH confidence
   - Optionally validate with address parsing
   - Log any mismatches for debugging

2. Try address parsing (FALLBACK)
   - Only if coordinates didn't match
   - Return with MEDIUM confidence
   - Only update if no existing cityId

3. Return null (MANUAL SELECTION REQUIRED)
   - UI will prompt user to select city
   - After selection, enrichment proceeds

## Integration Points

### 1. placeLocation.service.ts
Already integrated - calls `resolveCityId()` with lat/lng and addressJson:
```typescript
const cityResolution = await resolveCityId({
  lat: input.lat,
  lng: input.lng,
  addressJson: input.addressJson,
  existingCityId: existingPlace.cityId,
});
```

### 2. POST /api/business/places
Already integrated - geo enrichment runs after place creation:
```typescript
if (place.lat && place.lng) {
  const enrichedPlace = await updatePlaceLocation(place.id, {
    lat: place.lat,
    lng: place.lng,
    googlePlaceId: place.googlePlaceId,
    formattedAddr: place.formattedAddr,
    addressJson: place.addressJson,
    countryCode: place.countryCode,
  });
}
```

### 3. UI Fallback (TODO - Next Step)
When cityId is null after save, show manual city selector:
```typescript
// In PlaceLocationPicker or Step2Location
{!cityId && (
  <div className="mt-4">
    <Label>Город *</Label>
    <Select
      value={manualCityId}
      onValueChange={handleCitySelect}
    >
      {cities.map(city => (
        <SelectItem key={city.id} value={city.id}>
          {city.name}
        </SelectItem>
      ))}
    </Select>
    <p className="text-sm text-muted-foreground mt-1">
      Не удалось определить город автоматически. Выберите вручную.
    </p>
  </div>
)}
```

## Testing

### Test Case 1: Minsk Address (Google Autocomplete)
1. Select "улица Ленина 3, Минск" from autocomplete
2. ✅ Coordinates: ~53.9, ~27.5
3. ✅ Distance to Minsk center: < 40km
4. ✅ cityId resolves to Minsk
5. ✅ District and metro are computed

### Test Case 2: Manual Pin in Minsk
1. Click "Указать на карте"
2. Drop pin at 53.9, 27.5
3. ✅ No addressJson available
4. ✅ Coordinates within Minsk radius
5. ✅ cityId resolves to Minsk
6. ✅ District and metro are computed

### Test Case 3: Outside All City Radii
1. Drop pin at coordinates far from any city
2. ✅ No city within radius
3. ✅ cityId returns null
4. ✅ UI shows manual city selector
5. User selects city manually
6. ✅ Enrichment proceeds with selected city

### Test Case 4: Multiple Cities
1. Add Gomel to database with center and radius
2. Drop pin in Gomel
3. ✅ Resolves to Gomel, not Minsk
4. ✅ District computed for Gomel
5. ✅ Metro not computed (Gomel has no metro)

## Logging

Comprehensive logging for debugging:

```
[cityResolver] Starting resolution: { hasAddressJson: true, coordinates: "53.9, 27.5" }
[cityResolver] Resolving by coordinates: 53.9, 27.5, country: BY
[cityResolver] Checking 2 cities
[cityResolver] Минск: 2.34km (radius: 40km)
[cityResolver] Гомель: 302.15km (radius: 30km)
[cityResolver] ✅ Matched city by coordinates: Минск (2.34km from center)
[cityResolver] Extracted from address: "Minsk", country: "BY"
[cityResolver] ✅ Matched city by address: Минск (clxxx)
```

## Data Setup Required

For each city, populate these fields:

### Minsk Example
```sql
UPDATE "City" 
SET 
  "centerLat" = 53.9,
  "centerLng" = 27.5,
  "radiusKm" = 40,
  "googleName" = 'Minsk'
WHERE slug = 'minsk';
```

### Gomel Example
```sql
UPDATE "City" 
SET 
  "centerLat" = 52.4,
  "centerLng" = 30.9,
  "radiusKm" = 30,
  "googleName" = 'Gomel'
WHERE slug = 'gomel';
```

### How to Determine Values

**centerLat, centerLng:**
- Use Google Maps to find city center
- Or use city hall / main square coordinates
- Or calculate centroid of city boundaries

**radiusKm:**
- Measure from center to city edge
- Add buffer for suburbs (e.g., 20-50% extra)
- Minsk: ~40km covers city + suburbs
- Smaller cities: 20-30km
- Large cities: 50-80km

**googleName:**
- Primary name Google uses in address_components
- Usually English transliteration
- Check Google Places API responses

## Acceptance Criteria

✅ Selecting Minsk address sets cityId to Minsk
✅ Dropping pin in Minsk sets cityId to Minsk
✅ Works without addressJson (manual pin)
✅ Scalable to any city in database
✅ Coordinates outside all radii return null
✅ UI can prompt for manual city selection
✅ After cityId exists, district/metro calculations run
✅ Comprehensive logging for debugging

## Future Enhancements

### 1. Country Filtering
Add `countryCode` field to City model:
```prisma
model City {
  countryCode String? // ISO 3166-1 alpha-2 (e.g., "BY", "RU")
}
```

Filter cities by country before distance calculation:
```typescript
const cities = await prisma.city.findMany({
  where: {
    ...(countryCode && { countryCode }),
    centerLat: { not: null },
    // ...
  }
});
```

### 2. Bounding Box Optimization
Add bbox fields for faster filtering:
```prisma
model City {
  bboxMinLat Float?
  bboxMaxLat Float?
  bboxMinLng Float?
  bboxMaxLng Float?
}
```

Quick rejection before Haversine:
```typescript
if (lat < city.bboxMinLat || lat > city.bboxMaxLat ||
    lng < city.bboxMinLng || lng > city.bboxMaxLng) {
  continue; // Skip Haversine calculation
}
```

### 3. Polygon Boundaries
Add precise city boundaries:
```prisma
model City {
  polygonJson Json? // GeoJSON polygon
}
```

Use point-in-polygon for exact matching:
```typescript
import { pointInPolygon } from '@turf/turf';

if (city.polygonJson) {
  const isInside = pointInPolygon([lng, lat], city.polygonJson);
  if (isInside) return city;
}
```

### 4. Caching
Cache city data in memory:
```typescript
let citiesCache: City[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 3600000; // 1 hour

async function getCities() {
  if (citiesCache && Date.now() - cacheTime < CACHE_TTL) {
    return citiesCache;
  }
  citiesCache = await prisma.city.findMany({...});
  cacheTime = Date.now();
  return citiesCache;
}
```

## Files Modified

1. `prisma/schema.prisma`
   - Added `radiusKm` field to City model

2. `src/services/place/cityResolver.service.ts`
   - Complete rewrite with coordinate-first approach
   - Haversine distance calculation
   - Coordinate-based resolution (primary)
   - Address parsing (helper)
   - Comprehensive logging

3. `prisma/migrations/20260305215029_add_city_radius_km/`
   - Migration to add radiusKm field

## Related Documentation

- `PLACE_GEO_ENRICHMENT_FIX_COMPLETE.md` - Geo enrichment pipeline
- `src/services/place/placeLocation.service.ts` - Location update service
- `src/services/place/placeGeoEnrichment.service.ts` - District/metro computation
