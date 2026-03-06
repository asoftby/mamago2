# Context Transfer - City Coordinate Resolution

## Summary

Implemented robust coordinate-based city resolution that works for places in ANY city, not just Minsk. The system now uses lat/lng coordinates as the primary method to determine cityId, making it scalable and reliable for both Google autocomplete and manual pin drops.

## Problem

- cityId often stayed null after saving location
- System relied too heavily on Google address parsing
- Manual pin drops (no addressJson) couldn't resolve city
- District and metro enrichment failed without cityId
- System was Minsk-centric, not scalable to other cities

## Solution

### 1. Database Schema Enhancement
Added `radiusKm` field to City model for coordinate-based matching:
```prisma
model City {
  centerLat Float?  // City center latitude
  centerLng Float?  // City center longitude
  radiusKm  Float?  // Search radius in km (e.g., 40 for Minsk)
}
```

### 2. Coordinate-Based Resolution (PRIMARY)
Completely rewrote `cityResolver.service.ts`:
- Calculate distance from place to all city centers using Haversine formula
- Match if distance <= city.radiusKm
- Works for both Google autocomplete AND manual pin drops
- Scalable to any number of cities

### 3. Address Parsing (HELPER)
- Extract city name from Google addressJson
- Used to validate coordinate-based result
- Provides hints when coordinates are ambiguous
- Coordinates always win in case of mismatch

### 4. Manual Fallback (UI - TODO)
- If no city matches, return null
- UI will prompt user to manually select city
- After manual selection, enrichment proceeds normally

## Resolution Algorithm

```
1. Coordinate-Based (PRIMARY):
   - Load all cities with centerLat, centerLng, radiusKm
   - Calculate distance to each city center
   - Find nearest city where distance <= radiusKm
   - Return cityId with HIGH confidence
   
2. Address Parsing (HELPER):
   - Extract city name from addressJson
   - Match against City.googleName, name, or slug
   - Used to validate coordinate result
   - Return cityId with MEDIUM confidence
   
3. Manual Fallback:
   - If no match found, return null
   - UI prompts user to select city
   - After selection, enrichment proceeds
```

## Files Modified

1. **prisma/schema.prisma**
   - Added `radiusKm Float?` to City model

2. **src/services/place/cityResolver.service.ts**
   - Complete rewrite with coordinate-first approach
   - Haversine distance calculation in kilometers
   - Coordinate-based resolution (primary method)
   - Address parsing (validation helper)
   - Comprehensive logging for debugging

3. **prisma/migrations/20260305215029_add_city_radius_km/**
   - Migration to add radiusKm field

4. **scripts/setup-city-coordinates.sql**
   - SQL script to populate city coordinates
   - Includes Minsk, Gomel, Mogilev, Vitebsk, Grodno, Brest

## Data Setup Required

Run the setup script:
```bash
psql -d mamago2 -f scripts/setup-city-coordinates.sql
```

This populates for each city:
- `centerLat` - City center latitude
- `centerLng` - City center longitude
- `radiusKm` - Search radius (20-40km depending on city size)
- `googleName` - Primary name Google uses

## Integration

The new cityResolver is already integrated:

### placeLocation.service.ts
```typescript
const cityResolution = await resolveCityId({
  lat: input.lat,
  lng: input.lng,
  addressJson: input.addressJson,
  existingCityId: existingPlace.cityId,
});
```

### POST /api/business/places
```typescript
if (place.lat && place.lng) {
  const enrichedPlace = await updatePlaceLocation(place.id, {
    lat, lng, googlePlaceId, formattedAddr, addressJson, countryCode
  });
}
```

## Testing

See `CITY_RESOLUTION_TESTING_GUIDE.md` for detailed testing instructions.

Quick tests:
1. ✅ Select Minsk address → cityId = Minsk
2. ✅ Drop pin in Minsk → cityId = Minsk (no addressJson!)
3. ✅ Select Gomel address → cityId = Gomel
4. ✅ Drop pin outside all radii → cityId = null (manual selection)

## Logging

Comprehensive logging for debugging:
```
[cityResolver] Starting resolution: { coordinates: "53.9, 27.5" }
[cityResolver] Resolving by coordinates: 53.9, 27.5
[cityResolver] Checking 6 cities
[cityResolver] Минск: 2.34km (radius: 40km)
[cityResolver] Гомель: 302.15km (radius: 30km)
[cityResolver] ✅ Matched city by coordinates: Минск (2.34km from center)
```

## Acceptance Criteria

✅ Selecting any Minsk address sets cityId to Minsk
✅ Dropping pin in Minsk sets cityId to Minsk
✅ Works without addressJson (manual pin drops)
✅ Scalable to any city in database
✅ Coordinates outside all radii return null
✅ After cityId exists, district/metro calculations run
✅ Comprehensive logging for debugging
✅ Resolution time < 100ms for typical city count

## Next Steps

### 1. UI Manual City Selector (TODO)
When cityId is null, show dropdown:
```typescript
{!cityId && (
  <Select value={manualCityId} onValueChange={handleCitySelect}>
    {cities.map(city => (
      <SelectItem key={city.id} value={city.id}>
        {city.name}
      </SelectItem>
    ))}
  </Select>
)}
```

### 2. Add More Cities
Populate coordinates for all cities in database:
```sql
UPDATE "City" 
SET "centerLat" = X, "centerLng" = Y, "radiusKm" = Z
WHERE slug = 'city-slug';
```

### 3. Future Optimizations
- Add `countryCode` field for filtering
- Add bounding box fields for faster rejection
- Add `polygonJson` for precise boundaries
- Cache city data in memory

## Related Documentation

- `CITY_COORDINATE_RESOLUTION_COMPLETE.md` - Complete implementation details
- `CITY_RESOLUTION_TESTING_GUIDE.md` - Testing instructions
- `PLACE_GEO_ENRICHMENT_FIX_COMPLETE.md` - Geo enrichment pipeline
- `scripts/setup-city-coordinates.sql` - Database setup script
