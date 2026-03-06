# City Resolution Testing Guide

## Quick Verification

Run these commands to verify the fix:

```bash
# 1. Check city coordinates are populated
npx tsx scripts/check-city-coordinates.ts

# 2. Test city resolution logic
npx tsx scripts/test-city-resolution.ts

# 3. Test full E2E pipeline
npx tsx scripts/test-place-geo-enrichment.ts
```

All tests should pass with ✅.

## Manual UI Testing

### Test Case 1: Google Autocomplete Address

1. Navigate to `/business/places/new`
2. Fill Step 1 (title, category, description)
3. Click "Далее" to Step 2
4. In the search box, type: `Мястровская 5`
5. Select the autocomplete suggestion
6. Click "Сохранить черновик"
7. Check browser console for logs:
   ```
   [cityResolver] ✅ Matched city by coordinates: Минск (3.87km from center)
   [placeLocation] ✅ Updated cityId: cmmap1t160011wsa4n1f0ymz1
   [placeGeoEnrichment] ✅ Enriched place: { cityId, districtAutoId, metroAutoId }
   ```
8. Verify in UI that city/district/metro are shown

### Test Case 2: Manual Pin on Map

1. Navigate to `/business/places/new`
2. Fill Step 1
3. Click "Далее" to Step 2
4. Click "Указать на карте"
5. Place pin anywhere in Minsk
6. Click "Сохранить"
7. Click "Сохранить черновик"
8. Check console for same logs
9. Verify city is resolved

### Test Case 3: Outside City Radius

1. Navigate to `/business/places/new`
2. Fill Step 1
3. Click "Далее" to Step 2
4. Click "Указать на карте"
5. Place pin far outside Minsk (e.g., Gomel area)
6. Click "Сохранить"
7. Click "Сохранить черновик"
8. Check console:
   ```
   [cityResolver] ⚠️ No city found within radius
   [cityResolver] ❌ Could not resolve cityId - manual selection required
   ```
9. UI should show "Select City" dropdown (future feature)

## Expected Console Logs

### Successful Resolution
```
[placeLocation] 🔄 Starting update for place <id>
[placeLocation] Step 1: Fetching existing place...
[placeLocation] ✅ Found place, existing cityId: null
[placeLocation] Step 2: Persisting location data...
[placeLocation] ✅ Persisted location data
[placeLocation] Step 3: Resolving cityId...
[cityResolver] Starting resolution: { hasAddressJson: true, coordinates: '53.9006, 27.559' }
[cityResolver] Resolving by coordinates: 53.9006, 27.559, country: BY
[cityResolver] Checking 1 cities
[cityResolver] Минск: 3.87km (radius: 40km)
[cityResolver] ✅ Matched city by coordinates: Минск (3.87km from center)
[cityResolver] Extracted from address: "Minsk", country: "BY"
[cityResolver] ✅ Matched city by address: Минск
[placeLocation] City resolution result: { cityId: '...', cityName: 'Минск', confidence: 'high' }
[placeLocation] Step 4: Updating cityId...
[placeLocation] ✅ Updated cityId: cmmap1t160011wsa4n1f0ymz1 (confidence: high)
[placeLocation] Step 5: Running geo enrichment...
[placeGeoEnrichment] ✅ Enriched place: { cityId, districtAutoId, metroAutoId, metroAutoDistanceM }
[placeLocation] ✅ Geo enrichment completed
[placeLocation] Step 6: Fetching final place data...
[placeLocation] ✅ Location update complete
```

### Failed Resolution (Outside Radius)
```
[cityResolver] Resolving by coordinates: 52.4345, 30.9754, country: any
[cityResolver] Checking 1 cities
[cityResolver] Минск: 283.19km (radius: 40km)
[cityResolver] ⚠️ No city found within radius for coordinates
[cityResolver] ❌ Could not resolve cityId - manual selection required
[placeLocation] City resolution result: { cityId: null, confidence: null, shouldUpdate: false }
```

## Troubleshooting

### Issue: cityId still null after selecting Minsk address

**Check 1: Prisma client regenerated?**
```bash
npx prisma generate
```

**Check 2: City coordinates populated?**
```bash
npx tsx scripts/check-city-coordinates.ts
```
Should show:
```
✅ Минск (minsk)
   Center: 53.9, 27.5
   Radius: 40 km
   Google: Minsk
```

If not, run:
```bash
npx tsx scripts/seed-city-coordinates.ts
```

**Check 3: Server logs**
Look for errors in the terminal running `npm run dev`

**Check 4: Browser console**
Look for errors or failed API calls

### Issue: TypeScript errors in cityResolver.service.ts

Run:
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

Then restart your IDE/TypeScript server.

### Issue: Tests fail

Check database connection:
```bash
npx prisma db pull
```

Verify migrations are applied:
```bash
npx prisma migrate status
```

## Database Queries

Check a place's geo data directly:

```sql
SELECT 
  id,
  title,
  lat,
  lng,
  "cityId",
  "districtAutoId",
  "metroAutoId",
  "metroAutoDistanceM"
FROM "Place"
WHERE "ownerUserId" = '<your-user-id>'
ORDER BY "createdAt" DESC
LIMIT 5;
```

Check city configuration:

```sql
SELECT 
  name,
  slug,
  "centerLat",
  "centerLng",
  "radiusKm",
  "googleName"
FROM "City"
WHERE "centerLat" IS NOT NULL;
```

## Success Criteria

✅ All automated tests pass
✅ Selecting Minsk address resolves cityId
✅ Manual pin in Minsk resolves cityId
✅ District and metro are enriched
✅ Console logs show successful resolution
✅ No TypeScript errors
✅ No runtime errors in browser console
