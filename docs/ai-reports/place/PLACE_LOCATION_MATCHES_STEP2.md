# Place Location Matches & Step 2 Flow - Implementation Summary

## Overview
Implemented duplicate detection and nearby place matching for Step 2 "Местоположение" in the Place creation wizard. The system now checks for existing places at the same address or within 100m radius and guides users to either select an existing place or add their own unit/location.

## Changes Made

### 1. Location Matches API Endpoint
**File:** `src/app/api/business/places/location/matches/route.ts`

**Endpoint:** `GET /api/business/places/location/matches`

**Query Parameters:**
- `placeId` (required) - Current place ID to exclude from results
- `lat`, `lng` (optional) - Coordinates for nearby search
- `formattedAddr` (optional) - Address for text matching
- `googlePlaceId` (optional) - Google Place ID for exact duplicate check

**Logic:**
1. **Exact Duplicate Check:** If `googlePlaceId` provided, finds exact match by Google Place ID
2. **Nearby Search:** If `lat`/`lng` provided:
   - Calculates bounding box (±100m)
   - Filters by haversine distance ≤ 100m
   - Returns matches with distance in meters
3. **Address Match:** If `formattedAddr` provided:
   - Searches in both `formattedAddr` and `customAddress` fields
   - Case-insensitive contains match
   - Limits to 20 results

**Response:**
```json
{
  "exactDuplicate": PlaceSummary | null,
  "matches": PlaceSummary[],
  "radiusMeters": 100
}
```

**PlaceSummary Type:**
```typescript
{
  id: string;
  title: string;
  formattedAddr: string | null;
  customAddress: string | null;
  placeKind: string; // STANDALONE | COMPLEX | UNIT
  parentPlaceId: string | null;
  lat: number | null;
  lng: number | null;
  distanceMeters?: number; // Only for nearby matches
}
```

### 2. PlaceLocationPicker UI Updates
**File:** `src/components/business/place/PlaceLocationPicker.tsx`

**New State:**
- `matches` - Array of nearby/matching places
- `exactDuplicate` - Exact Google Place ID duplicate (if found)
- `isCheckingMatches` - Loading state for matches API call

**New Function:**
- `checkLocationMatches()` - Calls matches API after location selection
- Updated `processLocationData()` to be async and call `checkLocationMatches()` before saving

**UI Changes:**
1. **Matches Block** (shown when matches found):
   - Amber-colored alert box: "По этому адресу уже есть места"
   - Red warning for exact duplicate (same Google Place ID)
   - List of up to 5 nearby places with:
     - Title
     - Address
     - Distance in meters
     - Place kind badge (Комплекс/Юнит)
     - "Открыть →" link to view existing place
   - "Добавить своё место по этому адресу" button (primary action)

2. **Match Display:**
   - Shows distance for nearby matches (~50м)
   - Shows place kind badge for COMPLEX/UNIT
   - Truncates long titles
   - Opens existing places in new tab

## Flow

### User Journey
1. User enters address/place name in autocomplete
2. System gets precise coordinates via PlacesService.getDetails or Geocoder
3. Map centers on location, marker placed
4. **NEW:** System calls matches API to check for duplicates/nearby places
5. **NEW:** If matches found, shows alert with list and "Add your place" button
6. Location saved to server

### Duplicate Detection Strategy
- **Exact Match:** Same Google Place ID = exact duplicate (red warning)
- **Nearby:** Within 100m radius = potential duplicate (amber alert)
- **Address:** Text match in formattedAddr or customAddress = soft match

## Next Steps (Not Yet Implemented)

### Unit/Complex Flow
When user clicks "Добавить своё место по этому адресу":
1. Show checkbox: "Объект находится в ТЦ / комплексе"
2. If checked, show fields:
   - Этаж (floor)
   - Павильон / офис (unit)
   - Название секции (unitLabel)
   - Как найти (customAddress)
   - Select parent place from matches (if COMPLEX found)
3. Update `placeKind` to UNIT
4. Save via PATCH `/api/business/places/[id]`

### Manual Point Selection
1. Add "Уточнить точку вручную" toggle
2. Make map clickable
3. Allow marker drag
4. Show lat/lng readonly (6 decimals)
5. Save via POST `/api/business/places/[id]/location/manual`

### Manual Address Mode
1. Add "Не нахожу в Google" button
2. Show textarea: "Мой адрес (текстом)"
3. Manual point selection on map
4. Save with `locationSource = MANUAL`, `googlePlaceId = null`

## Technical Details

### Haversine Distance Formula
```typescript
function calculateDistance(lat1, lng1, lat2, lng2): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### Bounding Box Calculation
```typescript
const dLat = 100 / 111320; // 1 degree latitude ≈ 111.32 km
const dLng = 100 / (111320 * Math.cos((lat * Math.PI) / 180));
```

### Sorting Strategy
Matches sorted by:
1. Distance (ascending) - if available
2. Creation date (descending) - fallback

## Database Schema Support

All required fields already exist in Place model:
- `googlePlaceId` - For exact duplicate detection
- `lat`, `lng` - For nearby search
- `formattedAddr` - For address matching
- `customAddress` - For manual address text
- `placeKind` - STANDALONE | COMPLEX | UNIT
- `parentPlaceId` - For unit → complex relation
- `floor`, `unit`, `unitLabel` - For unit details
- `locationSource` - GOOGLE | MANUAL

## API Endpoints Ready

### Existing Endpoints (Already Implemented)
- `POST /api/business/places/[id]/location/google` - Save Google location
- `POST /api/business/places/[id]/location/manual` - Save manual location
- `PATCH /api/business/places/[id]` - Update place fields (supports placeKind, floor, unit, unitLabel, parentPlaceId, customAddress)

### New Endpoint (Just Implemented)
- `GET /api/business/places/location/matches` - Find duplicates and nearby places

## Testing Checklist

- [x] API endpoint compiles without errors
- [x] UI component compiles without errors
- [x] Prisma client regenerated
- [ ] Test exact duplicate detection (same Google Place ID)
- [ ] Test nearby search (100m radius)
- [ ] Test address matching (formattedAddr and customAddress)
- [ ] Test matches display in UI
- [ ] Test "Открыть →" link to existing place
- [ ] Test "Добавить своё место" button (currently logs to console)

## Known Limitations

1. **Unit Flow Not Implemented:** Button currently only logs to console
2. **Manual Point Selection Not Implemented:** No UI for dragging marker or clicking map
3. **Manual Address Mode Not Implemented:** No "Не нахожу в Google" option
4. **Parent Place Selection Not Implemented:** No dropdown to select parent COMPLEX from matches

## Files Modified

1. `src/app/api/business/places/location/matches/route.ts` - NEW
2. `src/components/business/place/PlaceLocationPicker.tsx` - UPDATED

## Dependencies

- Existing Google Maps integration (PlacesService, Geocoder)
- Existing auth system (getCurrentUser)
- Existing Prisma schema (Place model with all required fields)
- Existing location save endpoints

## Performance Considerations

- Bounding box pre-filter reduces database load
- Haversine calculation in JavaScript (not PostGIS) - acceptable for 100m radius
- Address search limited to 20 results
- Matches display limited to 5 in UI (with "...and N more" message)

## Security

- BUSINESS_OWNER role required
- Ownership check via getCurrentUser()
- Current place excluded from matches (prevents self-match)

## UX Improvements

- Clear visual hierarchy (red for exact duplicate, amber for nearby)
- Distance shown in meters for context
- Place kind badges for COMPLEX/UNIT
- Direct links to view existing places
- Primary action button for "Add your place"

---

**Status:** ✅ Phase 1 Complete (Matches Detection & Display)
**Next:** Phase 2 (Unit Flow, Manual Point, Manual Address)
