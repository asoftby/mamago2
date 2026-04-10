# City Resolution - Quick Testing Guide

## ✅ Status: FIXED & READY TO TEST

## Quick Test (2 minutes)

### Test in UI
1. Navigate to http://localhost:3002/business/places/new
2. Fill Step 1:
   - Title: "Test Place"
   - Category: Any
   - Short description: "Testing city resolution"
3. Navigate to Step 2
4. In address search, type: "Мястровская 5"
5. Select: "вуліца Мястроўская 5, Мінск, Беларусь"
6. Click "Save Draft"

### Expected Results
✅ Place created successfully
✅ Browser console shows:
```
[cityResolver] Found alias match: "Мінск" -> slug "minsk"
[cityResolver] ✅ Matched city by address (alias): Минск
[placeLocation] ✅ Updated cityId
[placeGeoEnrichment] ✅ Enriched place
```

✅ In database, Place record has:
- cityId: (Minsk city ID)
- districtAutoId: (district ID)
- metroAutoId: (metro station ID)
- metroAutoDistanceM: (distance in meters)

## Test Scripts

### Diagnostic Test
```bash
npx tsx scripts/diagnostics/diagnose-city-resolution.ts
```

**Expected Output:**
```
✅ SUCCESS: cityId resolved
   cityId: cmmap1t160011wsa4n1f0ymz1
   cityName: Минск
   confidence: high
```

### E2E Test
```bash
npx tsx scripts/manual-tests/test-place-creation-with-city.ts
```

**Expected Output:**
```
✅ cityId resolved
✅ city relation loaded: Минск
✅ districtAutoId resolved
✅ metroAutoId resolved
✅ ALL CHECKS PASSED
```

## What Was Fixed

**Problem:** Google returns "Мінск" (Belarusian) but database had "Minsk" (English)

**Solution:** Added alias matching for language variants:
- Belarusian: Мінск
- Russian: Минск
- English: Minsk

## Supported Cities

All major Belarusian cities with language variants:
- Minsk / Минск / Мінск
- Gomel / Гомель / Гомель
- Brest / Брест / Брэст
- Grodno / Гродно / Гродна
- Vitebsk / Витебск / Віцебск
- Mogilev / Могилёв / Магілёў

## Troubleshooting

### If cityId is still null:

1. **Check browser console** for error messages
2. **Check server logs** (terminal 24) for detailed pipeline logs
3. **Run diagnostic script** to isolate the issue:
   ```bash
   npx tsx scripts/diagnostics/diagnose-city-resolution.ts
   ```

### If district/metro not resolved:

1. Check if cityId is set (required for enrichment)
2. Check if city has district polygons in database
3. Check if city has metro stations in database
4. Review logs: `[placeGeoEnrichment]`

## Files Changed

1. **src/services/place/cityResolver.service.ts** - Added alias matching
2. **scripts/diagnostics/diagnose-city-resolution.ts** - Diagnostic tool (NEW)
3. **scripts/manual-tests/test-place-creation-with-city.ts** - E2E test (NEW)

## Documentation

- **CITY_RESOLUTION_LANGUAGE_VARIANT_FIX.md** - Complete technical docs
- **CITY_RESOLUTION_DIAGNOSTIC_COMPLETE.md** - Diagnostic process
- **CITY_RESOLUTION_TESTING_QUICK_GUIDE.md** - This file

## Success Criteria

✅ Selecting Minsk address sets cityId
✅ Works with Belarusian, Russian, and English variants
✅ District and metro are enriched
✅ No errors in console or server logs
✅ Diagnostic and E2E tests pass

## Next Steps

After confirming the fix works:
1. Test with other cities (Gomel, Brest, etc.)
2. Monitor logs for any unknown city variants
3. Add more aliases as needed
4. Consider migrating aliases to database (future enhancement)
