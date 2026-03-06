# Fix Location Error - Immediate Steps

## Problem
The location service works correctly (verified by test script), but Next.js dev server hasn't picked up the new code.

## Verified Working ✅
```bash
npx tsx scripts/test-location-service.ts
```
Output shows:
- ✅ Service test passed!
- ✅ CityId resolved: Минск
- ✅ Metro detected: Октябрьская (272m)
- ✅ District detected: Центральный

## Solution: Restart Dev Server with Clean Cache

### Option 1: Quick Script (Recommended)
```bash
# Stop current dev server (Ctrl+C in terminal)
# Then run:
./scripts/restart-dev.sh
pnpm dev
```

### Option 2: Manual Steps
```bash
# 1. Stop dev server (Ctrl+C)

# 2. Kill any lingering processes
pkill -f "next dev"

# 3. Clear Next.js cache
rm -rf .next

# 4. Regenerate Prisma client
npx prisma generate

# 5. Restart dev server
pnpm dev
```

## Why This Happens
Next.js 16 with Turbopack sometimes doesn't detect new service files automatically. Clearing the cache forces a full rebuild.

## After Restart

### 1. Test Location Selection
1. Navigate to: `http://localhost:3002/business/places/[id]/edit`
2. Go to Location step (Step 2)
3. Select address: "вулiца Камунiстычная 4, Мiнск"

### 2. Check Server Console
You should see:
```
[placeLocation] 🔄 Starting update for place ...
[placeLocation] Step 1: Fetching existing place...
[placeLocation] ✅ Found place, existing cityId: ...
[placeLocation] Step 2: Persisting location data...
[placeLocation] ✅ Persisted location data
[placeLocation] Step 3: Resolving cityId...
[cityResolver] Extracted city: "Minsk"
[cityResolver] ✅ Matched city by address: Минск
[placeLocation] ✅ Updated cityId (confidence: high)
[placeLocation] Step 5: Running geo enrichment...
[placeGeoEnrichment] ✅ Enriched place ...
[placeLocation] ✅ Location update complete
```

### 3. Check Debug Panel
Should show:
```json
{
  "cityId": "cmmap1t160011wsa4n1f0ymz1",
  "districtAutoId": "cmmap1t1e0013wsa4im3m5lhh",
  "metroAutoId": "cmmbq9ehw001mws8405uxzqxj",
  "metroAutoDistanceM": 272
}
```

### 4. Check Blue Box
Should display:
```
📍 Определено автоматически
Район: Центральный
Метро: Октябрьская · 272 м
```

## If Still Not Working

### Check TypeScript Server
In VS Code:
1. Press `Cmd+Shift+P`
2. Type "TypeScript: Restart TS Server"
3. Press Enter

### Verify Services Exist
```bash
ls -la src/services/place/
```

Should show:
- `cityResolver.service.ts`
- `placeLocation.service.ts`
- `placeGeoEnrichment.service.ts`

### Test Service Directly
```bash
npx tsx scripts/test-location-service.ts
```

Should show "✅ Service test passed!"

## Success Indicators

✅ Server starts without errors
✅ Location selection works
✅ Server logs show detailed steps
✅ Debug panel shows cityId, metro, district
✅ Blue box displays enriched data
✅ No "Internal server error" in console

## Still Having Issues?

If error persists after clean restart:

1. Check Node.js version: `node --version` (should be 18+)
2. Check pnpm version: `pnpm --version`
3. Try: `pnpm install` (reinstall dependencies)
4. Check for port conflicts: `lsof -i :3002`

## Quick Verification

After restart, run this in browser console on Location step:
```javascript
// Should show the new service is loaded
fetch('/api/business/places/YOUR_PLACE_ID/location/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    googlePlaceId: 'test',
    lat: 53.9,
    lng: 27.5,
    formattedAddr: 'Test'
  })
}).then(r => r.json()).then(console.log)
```

Should return place object with cityId, metro, district populated.
