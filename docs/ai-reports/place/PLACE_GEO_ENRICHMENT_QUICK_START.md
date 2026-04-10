# Place Geo Enrichment - Quick Start Guide

## Setup (One-Time)

### 1. Apply Database Migration
```bash
npx prisma migrate dev
```

### 2. Seed District Centroids
```bash
npx tsx prisma/seed/district-centroids.ts
```

Expected output:
```
✅ Districts with centroids: 9/9
```

## Testing

### Test Enrichment Service
```bash
npx tsx scripts/manual-tests/test-place-geo-enrichment.ts
```

Expected output:
```
✅ Enrichment completed:
   District (after): [id]
   Metro (after): [id]
   Distance (after): [meters] meters
```

### Test in UI
1. Start dev server: `pnpm dev`
2. Navigate to Place Wizard → Location step
3. Select address: "вулiца Камунiстычная 4, Мiнск"
4. Check debug panel (yellow box) - should show populated IDs
5. Check blue box - should show district and metro names

## How It Works

### Automatic Enrichment
Enrichment runs automatically when:
- User selects address from Google autocomplete
- User confirms pin on map
- Any location update that changes lat/lng

### What Gets Computed
- **District**: Nearest district by centroid (approximate)
- **Metro**: Nearest metro station within 4km
- **Distance**: Haversine distance in meters

### CityId Resolution
1. Use place.cityId if exists
2. Else use single city if only one in DB
3. Else default to Minsk
4. Else skip enrichment

## Files Modified

### Core Service
- `src/services/place/placeGeoEnrichment.service.ts`

### API Endpoints
- `src/app/api/business/places/[id]/location/google/route.ts`
- `src/app/api/business/places/[id]/location/manual/route.ts`

### UI Component
- `src/components/business/place/PlaceLocationPicker.tsx`

### Database
- `prisma/schema.prisma` - Added District.centerLat/centerLng
- `prisma/migrations/20260305124539_add_district_centroids/`

### Scripts
- `prisma/seed/district-centroids.ts` - Seed script
- `scripts/manual-tests/test-place-geo-enrichment.ts` - Test script

## Configuration

### Metro Search Radius
Edit `src/services/place/placeGeoEnrichment.service.ts`:
```typescript
const METRO_SEARCH_RADIUS_METERS = 4000; // Change this value
```

### District Centroids
Edit `prisma/seed/district-centroids.ts`:
```typescript
const MINSK_DISTRICT_CENTROIDS = [
  { name: "Центральный", centerLat: 53.9006, centerLng: 27.5590 },
  // Add or modify districts here
];
```

Then re-run: `npx tsx prisma/seed/district-centroids.ts`

## Debugging

### Check Server Logs
Look for:
```
[placeGeoEnrichment] Using single city: [cityId]
[placeGeoEnrichment] ✅ Enriched place [placeId]: { ... }
[location/google] Geo enrichment completed for place [placeId]
```

### Check Debug Panel
Yellow box at top of Location step shows:
- lat/lng
- cityId
- districtAutoId
- metroAutoId
- metroAutoDistanceM

### Check Blue Box
Shows enriched data:
- Район: [district name]
- Метро: [metro name] · [distance]

## Common Issues

### Metro is null
- Check metro stations exist in database
- Verify coordinates are within 4km of a station
- Check cityId is resolved correctly

### District is null
- Run seed script: `npx tsx prisma/seed/district-centroids.ts`
- Verify 9 districts have centroids

### Enrichment not running
- Check server console for errors
- Verify place has lat/lng
- Check API response includes enriched fields

## Next Steps

1. ✅ MVP complete - district and metro enrichment working
2. 🔄 Implement cityId extraction from Google Places (see spec)
3. 🔄 Add manual override UI for district/metro
4. 🔄 Implement point-in-polygon for accurate district detection
