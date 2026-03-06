# Place Location Unified Pipeline - Complete Implementation

## Overview
Implemented a unified location handling system that ensures both Google autocomplete and manual map pin flows use the same pipeline for cityId resolution and geo enrichment.

## Problem Solved
Previously, when location changed (Google autocomplete OR manual pin), only lat/lng were updated. Place.cityId often remained NULL, preventing metro/district enrichment from running.

## Solution Architecture

### Single Source of Truth: PlaceLocationService
All location updates flow through one service with a consistent 5-step pipeline:

1. **Persist raw location data** (lat/lng, googlePlaceId, formattedAddr, addressJson)
2. **Resolve cityId** using CityResolver with multiple strategies
3. **Save cityId** to place (with confidence-based update logic)
4. **Run geo enrichment** (metro + district)
5. **Return updated place** with all geo fields

## Implementation Details

### 1. Database Schema Changes

**File**: `prisma/schema.prisma`

**City model enhancements**:
```prisma
model City {
  // Google Places matching
  googleName  String? // Primary Google name (e.g., "Minsk")
  googleNames Json?   // Alternative names array
  
  // City center for coordinate-based resolution
  centerLat Float?
  centerLng Float?
  
  // Metro configuration
  hasMetro          Boolean @default(false)
  metroMaxDistanceM Int?    // Max distance threshold (e.g., 2500 for Minsk)
  
  @@index([googleName])
}
```

**Migration**: `20260305193831_add_city_resolution_fields`

### 2. CityResolver Service

**File**: `src/services/place/cityResolver.service.ts`

**Three resolution strategies** (in order of confidence):

#### Strategy 1: Google address_components (HIGH confidence)
- Extracts city name from address_components
- Priority: `locality` > `administrative_area_level_2` > `administrative_area_level_1`
- Matches against City.googleName, City.name, or City.slug
- **Always updates** cityId when matched

#### Strategy 2: Coordinates (MEDIUM confidence)
- Finds nearest city by centerLat/centerLng using Haversine
- Within 40km radius (MAX_CITY_RADIUS_M)
- **Only updates** if place has no existing cityId

#### Strategy 3: Default city fallback (LOW confidence)
- Returns Minsk by slug (MVP)
- Falls back to single city if only one exists
- **Only updates** if place has no existing cityId

**Key functions**:
- `extractCityFromAddressComponents()` - Parses Google address data
- `resolveCityByAddressComponents()` - High confidence matching
- `resolveCityByCoordinates()` - Medium confidence matching
- `resolveDefaultCity()` - Low confidence fallback
- `resolveCityId()` - Main orchestrator

### 3. PlaceLocationService

**File**: `src/services/place/placeLocation.service.ts`

**Unified pipeline** for both flows:

```typescript
export async function updatePlaceLocation(
  placeId: string,
  input: UpdatePlaceLocationInput
)
```

**Input interface**:
```typescript
interface UpdatePlaceLocationInput {
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
  formattedAddr?: string | null;
  addressJson?: any | null;
  countryCode?: string | null;
}
```

**Pipeline steps**:
1. Get existing place data
2. Persist raw location fields (determines LocationSource automatically)
3. Resolve cityId using CityResolver
4. Update cityId if resolution succeeded and shouldUpdate=true
5. Run geo enrichment (calls PlaceGeoEnrichmentService)
6. Return updated place with all fields and relations

**Returns**: Complete place object with:
- Location fields (lat, lng, googlePlaceId, formattedAddr, etc.)
- cityId and city relation
- Geo enrichment fields (districtAutoId, metroAutoId, metroAutoDistanceM)
- All relations (city, districtAuto, districtManual, metroAuto, metroManual)

### 4. PlaceGeoEnrichmentService Updates

**File**: `src/services/place/placeGeoEnrichment.service.ts`

**Enhanced metro detection**:
- Checks `city.hasMetro` flag before searching
- Uses `city.metroMaxDistanceM` as threshold (or default 4000m)
- Returns null if city has no metro
- Respects city-specific configuration

**Metro threshold logic**:
```typescript
if (!city.hasMetro) return null;
const maxDistance = city.metroMaxDistanceM || METRO_SEARCH_RADIUS_METERS;
// Find nearest within maxDistance
```

### 5. API Endpoints Updated

**Both endpoints now use unified service**:

#### POST /api/business/places/[id]/location/google
**File**: `src/app/api/business/places/[id]/location/google/route.ts`

**Changes**:
- Removed manual location persistence logic
- Removed manual cityId handling
- Removed manual enrichment call
- Now calls: `updatePlaceLocation(id, { lat, lng, googlePlaceId, formattedAddr, addressJson, countryCode })`

#### POST /api/business/places/[id]/location/manual
**File**: `src/app/api/business/places/[id]/location/manual/route.ts`

**Changes**:
- Removed manual location persistence logic
- Removed manual cityId handling
- Removed manual enrichment call
- Now calls: `updatePlaceLocation(id, { lat, lng, formattedAddr: customAddress, countryCode })`

**Result**: Both flows use identical pipeline, ensuring consistent behavior.

### 6. City Configuration Seed

**File**: `prisma/seed/city-configuration.ts`

**Configures cities with**:
- Google name for matching (e.g., "Minsk")
- Alternative names array (e.g., ["Minsk", "Минск", "Мінск"])
- Center coordinates for resolution
- Metro configuration (hasMetro, metroMaxDistanceM)

**Minsk configuration**:
```typescript
{
  slug: "minsk",
  name: "Минск",
  googleName: "Minsk",
  googleNames: ["Minsk", "Минск", "Мінск"],
  centerLat: 53.9006,
  centerLng: 27.5590,
  hasMetro: true,
  metroMaxDistanceM: 2500, // 2.5km threshold
}
```

**Usage**: `npx tsx prisma/seed/city-configuration.ts`

## Data Flow

### Google Autocomplete Flow
```
User selects "вулiца Камунiстычная 4, Мiнск"
  ↓
PlaceSearchInput extracts:
  - googlePlaceId
  - lat/lng
  - formattedAddr
  - addressJson (with address_components)
  ↓
POST /api/business/places/[id]/location/google
  ↓
updatePlaceLocation() called
  ↓
STEP 1: Persist lat/lng, googlePlaceId, formattedAddr, addressJson
  ↓
STEP 2: CityResolver.resolveCityId()
  - Strategy 1: Extract "Minsk" from address_components
  - Match against City.googleName = "Minsk"
  - Return cityId with HIGH confidence
  ↓
STEP 3: Update place.cityId (high confidence → always update)
  ↓
STEP 4: enrichPlaceGeo()
  - Check city.hasMetro = true
  - Find nearest metro within city.metroMaxDistanceM (2500m)
  - Find nearest district by centroid
  - Update districtAutoId, metroAutoId, metroAutoDistanceM
  ↓
STEP 5: Return enriched place
  ↓
UI updates with cityId, metro, district
```

### Manual Pin Flow
```
User confirms pin on map at (53.9045, 27.5615)
  ↓
PlaceMapModal extracts:
  - lat/lng only
  - No addressJson
  ↓
POST /api/business/places/[id]/location/manual
  ↓
updatePlaceLocation() called
  ↓
STEP 1: Persist lat/lng
  ↓
STEP 2: CityResolver.resolveCityId()
  - Strategy 1: Skip (no addressJson)
  - Strategy 2: Find nearest city by coordinates
    - Calculate distance to Minsk center (53.9006, 27.5590)
    - Distance ~450m (within 40km radius)
    - Return cityId with MEDIUM confidence
  ↓
STEP 3: Update place.cityId (medium confidence → only if null)
  ↓
STEP 4: enrichPlaceGeo()
  - Same as Google flow
  ↓
STEP 5: Return enriched place
  ↓
UI updates with cityId, metro, district
```

## Confidence-Based Update Logic

### High Confidence (Google address_components)
- **Always updates** cityId
- Overrides existing cityId
- Most reliable source

### Medium Confidence (Coordinates)
- **Only updates if** place.cityId is null
- Does NOT override existing cityId
- Reasonably reliable within city boundaries

### Low Confidence (Default fallback)
- **Only updates if** place.cityId is null
- Does NOT override existing cityId
- MVP fallback for single-city deployment

## Metro Configuration

### City-Level Settings
- `hasMetro`: Boolean flag (false for cities without metro)
- `metroMaxDistanceM`: Distance threshold in meters

### Minsk Configuration
- `hasMetro = true`
- `metroMaxDistanceM = 2500` (2.5km)

### Mogilev (Example)
- `hasMetro = false`
- `metroMaxDistanceM = null`
- Result: metroAutoId always null, no metro shown in UI

## Verification Steps

### 1. Check Database Migration
```bash
npx prisma migrate status
```
Should show: `20260305193831_add_city_resolution_fields` applied

### 2. Seed City Configuration
```bash
npx tsx prisma/seed/city-configuration.ts
```
Should show: "✅ Updated: Минск (minsk)"

### 3. Test Google Autocomplete
1. Start dev server: `pnpm dev`
2. Open Place Wizard → Location step
3. Select address: "вулiца Камунiстычная 4, Мiнск"
4. Check debug panel:
   ```json
   {
     "cityId": "cmmap1t160011wsa4n1f0ymz1",
     "districtAutoId": "cmmap1t1e0013wsa4im3m5lhh",
     "metroAutoId": "cmmbq9efl000uws84regajxpp",
     "metroAutoDistanceM": 911
   }
   ```
5. Check server logs:
   ```
   [cityResolver] Extracted city: "Minsk", country: "BY"
   [cityResolver] ✅ Matched city by address: Минск (cmmap1t160011wsa4n1f0ymz1)
   [placeLocation] ✅ Updated cityId: cmmap1t160011wsa4n1f0ymz1 (confidence: high)
   [placeGeoEnrichment] ✅ Enriched place ...
   ```

### 4. Test Manual Pin
1. Click "Выбрать точку на карте"
2. Move pin to location in Minsk
3. Click "Подтвердить"
4. Check debug panel - cityId should be populated
5. Check server logs:
   ```
   [cityResolver] ✅ Matched city by coordinates: Минск (450m away)
   [placeLocation] ✅ Updated cityId: cmmap1t160011wsa4n1f0ymz1 (confidence: medium)
   ```

### 5. Test City Without Metro
1. Configure test city with `hasMetro = false`
2. Select location in that city
3. Verify metroAutoId remains null
4. Verify UI doesn't show metro line

## Files Changed

### New Files
1. `src/services/place/cityResolver.service.ts` - City resolution service
2. `src/services/place/placeLocation.service.ts` - Unified location service
3. `prisma/seed/city-configuration.ts` - City configuration seed

### Modified Files
1. `prisma/schema.prisma` - Added City fields
2. `src/services/place/placeGeoEnrichment.service.ts` - Metro configuration support
3. `src/app/api/business/places/[id]/location/google/route.ts` - Use unified service
4. `src/app/api/business/places/[id]/location/manual/route.ts` - Use unified service

### Database
1. Migration: `prisma/migrations/20260305193831_add_city_resolution_fields/`

## Acceptance Criteria

✅ **1. Google autocomplete selection**:
- cityId is resolved from address_components
- metroAutoId and metroAutoDistanceM populated (if within threshold)
- districtAutoId populated (if centroids exist)
- Debug panel shows all fields

✅ **2. Manual map pin**:
- cityId resolved via nearest city center
- Enrichment runs the same way as Google flow
- Debug panel shows all fields

✅ **3. Changing location updates enrichment**:
- No stale values
- cityId updates based on confidence
- Metro/district recalculated

✅ **4. Cities without metro**:
- city.hasMetro=false → metroAutoId stays null
- UI doesn't show metro line for end users

✅ **5. Both flows use same pipeline**:
- Consistent behavior
- Single source of truth
- Unified logging

## Known Limitations

### 1. Google Names Matching
- Currently matches exact city names
- May need fuzzy matching for variations
- Can be improved with more googleNames entries

### 2. Coordinate Resolution Radius
- 40km radius may be too large for dense regions
- May need adjustment based on geography

### 3. Default City Fallback
- Currently hardcoded to Minsk
- Works for single-city MVP
- Multi-city deployment needs better fallback

## Future Improvements

### Short Term
1. Add more cities to configuration
2. Refine googleNames arrays for better matching
3. Add fuzzy matching for city names
4. Adjust coordinate resolution radius per region

### Long Term
1. Implement reverse geocoding for manual pins
2. Add city boundary polygons for accurate resolution
3. Support multi-country deployments
4. Add city-specific enrichment rules

## Troubleshooting

### cityId Still Null
**Check**:
1. City configuration seeded: `npx tsx prisma/seed/city-configuration.ts`
2. City has googleName set
3. Address_components contain city name
4. Server logs show resolution attempts

**Fix**:
- Add city name variations to googleNames
- Check address_components structure
- Verify city center coordinates

### Metro Not Detected
**Check**:
1. city.hasMetro = true
2. city.metroMaxDistanceM set correctly
3. Metro stations exist for city
4. Distance within threshold

**Fix**:
- Update city configuration
- Increase metroMaxDistanceM
- Verify metro station coordinates

### Wrong City Resolved
**Check**:
1. Confidence level in logs
2. Existing cityId value
3. Coordinate resolution distance

**Fix**:
- High confidence always updates (check Google name matching)
- Medium/low confidence preserves existing (check shouldUpdate logic)
- Adjust MAX_CITY_RADIUS_M if needed

## Summary

The unified location pipeline ensures consistent cityId resolution and geo enrichment for both Google autocomplete and manual pin flows. The system uses a confidence-based update strategy to balance accuracy with stability, and respects city-specific metro configuration for appropriate UI display.

All location updates now flow through a single service with comprehensive logging, making debugging and maintenance straightforward.
