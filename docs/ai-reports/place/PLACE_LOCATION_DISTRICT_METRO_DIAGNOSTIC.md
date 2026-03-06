# Place Location District & Metro Diagnostic Report

## Problem
Metro and district fields are NOT visible on the Location step (Step 2) for business owners in the Place Wizard.

## Root Cause Analysis

### 1. DATABASE LAYER ✅
**Status**: Fields exist and are correctly defined

The Place model in `prisma/schema.prisma` has all required fields:
- `districtAutoId` (String?, relation to District)
- `districtManualId` (String?, relation to District)
- `metroAutoId` (String?, relation to MetroStation)
- `metroAutoDistanceM` (Int?)
- `metroManualId` (String?, relation to MetroStation)
- `metroManualDistanceM` (Int?)
- `lat` (Float?)
- `lng` (Float?)
- `cityId` (String?, relation to City)

### 2. API LAYER ❌
**Status**: MISSING RELATIONS IN GET RESPONSE

**File**: `src/app/api/business/places/[id]/route.ts`

**Issue**: The GET endpoint includes `images`, `parentPlace`, and `children` relations, but does NOT include:
- `districtAuto` relation
- `districtManual` relation
- `metroAuto` relation
- `metroManual` relation
- `city` relation

**Current include block** (lines 23-38):
```typescript
include: {
  images: {
    orderBy: { sortOrder: "asc" },
  },
  parentPlace: {
    select: {
      id: true,
      title: true,
      formattedAddr: true,
    },
  },
  children: {
    select: {
      id: true,
      title: true,
      unitLabel: true,
      status: true,
    },
  },
}
```

**What's returned**: Only the IDs (districtAutoId, metroAutoId, etc.) are returned, but NOT the related entity names needed for display.

### 3. UI LAYER ⚠️
**Status**: UI IS IMPLEMENTED BUT CONDITIONALLY HIDDEN

**File**: `src/components/business/place/PlaceLocationPicker.tsx`

**Issue**: The district and metro UI is implemented (lines 523+) but has a conditional render:
```typescript
{location && cityId && (
  <div className="space-y-4">
    {/* District Select */}
    {/* Metro Select */}
  </div>
)}
```

**Why it's hidden**:
1. `location` exists when lat/lng are set ✅
2. `cityId` is likely NULL because it's not being extracted from Google Places address_components ❌

**Step2Location component** (`src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`):
- Correctly passes all geo fields to PlaceLocationPicker as `initialLocation`
- Fields include: cityId, districtAutoId, districtManualId, metroAutoId, metroAutoDistanceM, metroManualId, metroManualDistanceM

### 4. GEO ENRICHMENT LAYER ⚠️
**Status**: SERVICE EXISTS BUT NOT TRIGGERED

**File**: `src/services/geo/geoEnrichment.service.ts`

**Functions**:
- `enrichPlaceGeoData(lat, lng, cityId)` - computes district and metro
- `findNearestMetro(lat, lng, cityId)` - finds nearest metro within 2.5km
- `findDistrictByCoordinates(lat, lng, cityId)` - returns null (TODO: point-in-polygon)

**When it's called**:
- `/api/business/places/[id]/location/google` - ONLY if cityId is available
- `/api/business/places/[id]/location/manual` - ONLY if cityId is available

**Issue**: cityId is not being extracted from Google Places address_components, so enrichment is skipped.

## Summary

### Why District & Metro Are Not Visible

1. **Primary Issue**: `cityId` is NULL because PlaceSearchInput doesn't extract it from Google Places address_components
2. **Secondary Issue**: API doesn't return district/metro relation names (only IDs)
3. **Result**: UI conditional check `{location && cityId && ...}` fails, so district/metro fields never render

### Data Flow

```
User selects address from Google autocomplete
  ↓
PlaceSearchInput extracts: googlePlaceId, lat, lng, formattedAddr, addressJson
  ↓ (cityId is NOT extracted - BUG)
PlaceLocationPicker receives data WITHOUT cityId
  ↓
Location saved via /api/business/places/[id]/location/google
  ↓
API checks: if (cityId) { run geo enrichment } → SKIPPED (cityId is null)
  ↓
Place saved with lat/lng but NO cityId, NO district, NO metro
  ↓
Step2Location loads place via GET /api/business/places/[id]
  ↓
API returns place with cityId=null, districtAutoId=null, metroAutoId=null
  ↓
PlaceLocationPicker checks: {location && cityId && ...} → FALSE
  ↓
District & Metro UI never renders
```

## Files Involved

### Database
- `prisma/schema.prisma` - Place model with geo fields ✅

### API Layer
- `src/app/api/business/places/[id]/route.ts` - GET endpoint (missing relations) ❌
- `src/app/api/business/places/[id]/location/google/route.ts` - saves location + geo enrichment
- `src/app/api/business/places/[id]/location/manual/route.ts` - saves manual location + geo enrichment
- `src/app/api/business/places/[id]/geo/route.ts` - manual override for district/metro
- `src/app/api/geo/districts/route.ts` - lists districts for city
- `src/app/api/geo/metro-stations/route.ts` - lists metro stations for city

### UI Layer
- `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx` - Location step ✅
- `src/components/business/place/PlaceLocationPicker.tsx` - Location picker with district/metro UI ⚠️
- `src/components/business/place/PlaceSearchInput.tsx` - Google autocomplete (missing cityId extraction) ❌

### Services
- `src/services/geo/geoEnrichment.service.ts` - geo enrichment logic ✅

## Next Steps

See fixes in the following files:
1. Add debug UI to PlaceLocationPicker (dev-only)
2. Update GET /api/business/places/[id] to include district/metro relations
3. (Future) Implement cityId extraction in PlaceSearchInput (see spec: .kiro/specs/place-location-cityid-extraction/)
