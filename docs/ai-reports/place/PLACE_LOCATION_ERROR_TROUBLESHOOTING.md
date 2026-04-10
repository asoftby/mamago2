# Place Location Error Troubleshooting

## Current Error
```
Internal server error
at saveLocation (src/components/business/place/PlaceLocationPicker.tsx:265:15)
```

## Root Cause
The new unified location service was just implemented. The dev server needs to be restarted to pick up the changes.

## Fix Steps

### 1. Restart Dev Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
pnpm dev
```

### 2. Restart TypeScript Server (in VS Code)
```
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### 3. Test Location Selection
1. Navigate to Place Wizard → Location step
2. Select address: "вулiца Камунiстычная 4, Мiнск"
3. Watch server console for detailed logs

### 4. Check Server Logs
Look for these log messages:

**Success indicators**:
```
[placeLocation] 🔄 Starting update for place ...
[placeLocation] Step 1: Fetching existing place...
[placeLocation] ✅ Found place, existing cityId: ...
[placeLocation] Step 2: Persisting location data...
[placeLocation] ✅ Persisted location data
[placeLocation] Step 3: Resolving cityId...
[cityResolver] Extracted city: "Minsk"
[cityResolver] ✅ Matched city by address: Минск
[placeLocation] ✅ Updated cityId: ... (confidence: high)
[placeLocation] Step 5: Running geo enrichment...
[placeGeoEnrichment] ✅ Enriched place ...
[placeLocation] ✅ Location update complete
```

**Error indicators**:
```
[placeLocation] ❌ Error updating location for place ...
[placeLocation] Error details: { message: "...", stack: "..." }
```

## Common Issues

### Issue 1: Prisma Client Not Updated
**Symptom**: TypeScript errors about missing fields

**Fix**:
```bash
npx prisma generate
```

### Issue 2: Migration Not Applied
**Symptom**: Database errors about missing columns

**Fix**:
```bash
npx prisma migrate dev
```

### Issue 3: City Configuration Not Seeded
**Symptom**: cityId remains null, logs show "No city match found"

**Fix**:
```bash
npx tsx prisma/seed/city-configuration.ts
```

### Issue 4: Import Errors
**Symptom**: "Cannot find module" errors

**Fix**:
- Restart dev server
- Restart TypeScript server
- Check file paths in imports

## Verification

### Check Database
```bash
npx tsx scripts/manual-tests/test-city-fields.ts
```

Should show:
```json
{
  "id": "...",
  "name": "Минск",
  "slug": "minsk",
  "googleName": "Minsk",
  "googleNames": ["Minsk", "Минск", "Мінск"],
  "centerLat": 53.9006,
  "centerLng": 27.559,
  "hasMetro": true,
  "metroMaxDistanceM": 2500
}
```

### Check Services Compile
```bash
npx tsc --noEmit
```

Should show no errors in:
- `src/services/place/cityResolver.service.ts`
- `src/services/place/placeLocation.service.ts`
- `src/services/place/placeGeoEnrichment.service.ts`

## If Error Persists

### 1. Check Exact Error Message
Look in server console for:
```
[placeLocation] ❌ Error updating location for place ...
[placeLocation] Error details: { message: "...", stack: "..." }
```

### 2. Check Which Step Failed
The logs show which step (1-6) failed:
- Step 1: Database connection issue
- Step 2: Prisma update issue (check schema)
- Step 3: CityResolver issue (check city data)
- Step 4: CityId update issue
- Step 5: Geo enrichment issue (non-fatal, continues)
- Step 6: Final fetch issue

### 3. Common Step-Specific Issues

**Step 2 fails**: Schema mismatch
```bash
npx prisma migrate dev
npx prisma generate
```

**Step 3 fails**: City data missing
```bash
npx tsx prisma/seed/city-configuration.ts
```

**Step 5 fails**: District/metro data missing
```bash
npx tsx prisma/seed/district-centroids.ts
```

## Debug Mode

### Enable Verbose Logging
The services already have detailed logging. Just watch the server console.

### Test Individual Services

**Test CityResolver**:
```typescript
import { resolveCityId } from "@/services/place/cityResolver.service";

const result = await resolveCityId({
  lat: 53.9045,
  lng: 27.5615,
  addressJson: [...], // from Google
  existingCityId: null,
});

console.log(result);
```

**Test PlaceLocation**:
```typescript
import { updatePlaceLocation } from "@/services/place/placeLocation.service";

const place = await updatePlaceLocation("place-id", {
  lat: 53.9045,
  lng: 27.5615,
  googlePlaceId: "...",
  formattedAddr: "...",
  addressJson: [...],
});

console.log(place);
```

## Contact Points

If error persists after all troubleshooting:

1. Copy full error message from server console
2. Copy the step number where it failed
3. Copy the error details (message + stack)
4. Share for further investigation

## Quick Fix Checklist

- [ ] Restart dev server
- [ ] Restart TypeScript server
- [ ] Run `npx prisma generate`
- [ ] Run `npx tsx prisma/seed/city-configuration.ts`
- [ ] Test location selection
- [ ] Check server logs
- [ ] Verify cityId populated in debug panel
