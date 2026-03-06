# City Resolution Quick Fix

## Problem
`cityId` was always `null` after selecting Minsk address.

## Root Cause
City table missing `radiusKm` value (was NULL).

## Fix (3 commands)
```bash
# 1. Regenerate Prisma client
npx prisma generate

# 2. Populate city coordinates
npx tsx scripts/seed-city-coordinates.ts

# 3. Verify fix
npx tsx scripts/test-place-geo-enrichment.ts
```

## Expected Output
```
✅ Updated Minsk: center=(53.9, 27.5), radius=40km
✅ 1 cities ready for coordinate-based resolution

=== E2E TEST ===
✅ TEST PASSED: cityId resolved successfully!
   cityId: cmmap1t160011wsa4n1f0ymz1
   city: Минск
   districtAutoId: cmmap1t1e0013wsa4im3m5lhh
   metroAutoId: cmmbq9eff000sws84c734qe6l

Passed: 2/2 tests
✅ All E2E tests passed!
```

## Verify in UI
1. Go to `/business/places/new`
2. Fill Step 1, go to Step 2
3. Search "Мястровская 5"
4. Select address
5. Click "Сохранить черновик"
6. Check console: should see `[cityResolver] ✅ Matched city by coordinates: Минск`

## Files Changed
- `src/services/place/cityResolver.service.ts` - Fixed return type
- Database: City.radiusKm = 40 for Minsk

## Status
✅ Fixed and tested
✅ All tests pass
✅ Ready for production
