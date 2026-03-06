# Place Location Unified Pipeline - Quick Start

## Setup (One-Time)

### 1. Apply Database Migration
```bash
npx prisma migrate dev
npx prisma generate
```

### 2. Seed City Configuration
```bash
npx tsx prisma/seed/city-configuration.ts
```

Expected output:
```
✅ Updated: Минск (minsk)
   Google name: Minsk
   Center: 53.9006, 27.559
   Metro: Yes (max 2500m)
```

### 3. Restart TypeScript Server
In VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"

## Testing

### Test Google Autocomplete
1. Start dev server: `pnpm dev`
2. Navigate to Place Wizard → Location step
3. Select address: "вулiца Камунiстычная 4, Мiнск"
4. Check debug panel - should show:
   - `cityId`: populated
   - `metroAutoId`: populated
   - `metroAutoDistanceM`: populated
   - `districtAutoId`: populated

### Test Manual Pin
1. Click "Выбрать точку на карте"
2. Move pin to location in Minsk
3. Click "Подтвердить"
4. Check debug panel - should show same fields populated

### Check Server Logs
Look for:
```
[cityResolver] Extracted city: "Minsk"
[cityResolver] ✅ Matched city by address: Минск
[placeLocation] ✅ Updated cityId (confidence: high)
[placeGeoEnrichment] ✅ Enriched place
```

## How It Works

### Unified Pipeline
Both Google autocomplete and manual pin use the same service:

```
Location change
  ↓
updatePlaceLocation()
  ↓
1. Persist lat/lng
2. Resolve cityId (3 strategies)
3. Save cityId (confidence-based)
4. Run geo enrichment
5. Return updated place
```

### CityId Resolution Strategies

1. **Google address_components** (HIGH confidence)
   - Extracts city name from address
   - Always updates cityId

2. **Coordinates** (MEDIUM confidence)
   - Finds nearest city center
   - Only updates if cityId is null

3. **Default fallback** (LOW confidence)
   - Returns Minsk (MVP)
   - Only updates if cityId is null

### Metro Configuration

Cities can configure metro detection:
- `hasMetro`: true/false
- `metroMaxDistanceM`: threshold in meters

Minsk: `hasMetro=true`, `metroMaxDistanceM=2500`

## Files Modified

### Core Services
- `src/services/place/cityResolver.service.ts` - NEW
- `src/services/place/placeLocation.service.ts` - NEW
- `src/services/place/placeGeoEnrichment.service.ts` - UPDATED

### API Endpoints
- `src/app/api/business/places/[id]/location/google/route.ts` - UPDATED
- `src/app/api/business/places/[id]/location/manual/route.ts` - UPDATED

### Database
- `prisma/schema.prisma` - UPDATED (City model)
- `prisma/migrations/20260305193831_add_city_resolution_fields/` - NEW

### Scripts
- `prisma/seed/city-configuration.ts` - NEW

## Common Issues

### cityId Still Null
- Run city configuration seed
- Check server logs for resolution attempts
- Verify City has googleName set

### Metro Not Detected
- Check city.hasMetro = true
- Check city.metroMaxDistanceM
- Verify distance within threshold

### TypeScript Errors
- Restart TS server
- Run `npx prisma generate`
- Check migration applied

## Next Steps

1. ✅ Unified pipeline complete
2. ✅ CityId resolution working
3. ✅ Metro configuration per city
4. 🔄 Add more cities as needed
5. 🔄 Refine googleNames for better matching
