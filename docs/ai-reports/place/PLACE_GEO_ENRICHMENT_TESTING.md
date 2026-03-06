# Place Geo Enrichment - Testing Guide

## Quick Test (5 minutes)

### 1. Open New Place Wizard
```
http://localhost:3000/business/places/new
```

### 2. Fill Step 1
- Title: "Test Cafe"
- Category: "cafe"
- Short Description: "Test description"

### 3. Fill Step 2 - Select Address
- Type "улица Ленина 3, Минск" in search
- Select the first result from Google autocomplete
- You should see the map pin update

### 4. Save Draft
- Click "Сохранить черновик" button in header

### 5. Check Browser Console
Look for these log messages:

```
[NewPlaceWizard] Creating place with requestId: <uuid>
[NewPlaceWizard] Location data: {
  lat: 53.9,
  lng: 27.5,
  googlePlaceId: "ChIJ...",
  formattedAddr: "улица Ленина, 3, Минск",
  hasAddressJson: true
}
```

```
[places/POST] 🌍 Running geo enrichment for place: <placeId>
[places/POST] Location data: { ... }
```

```
[cityResolver] Starting resolution: { hasAddressJson: true, ... }
[cityResolver] Extracted city: "Минск", country: "BY"
[cityResolver] ✅ Matched city by address: Минск (<cityId>)
```

```
[placeGeoEnrichment] ✅ Enriched place <placeId>: {
  cityId: "<cityId>",
  districtAutoId: "<districtId>",
  districtName: "Центральный",
  metroAutoId: "<metroId>",
  metroName: "Площадь Ленина",
  metroAutoDistanceM: 450
}
```

```
[places/POST] ✅ Geo enrichment complete
[places/POST] Enriched data: {
  cityId: "<cityId>",
  districtAutoId: "<districtId>",
  metroAutoId: "<metroId>",
  metroAutoDistanceM: 450
}
```

```
[NewPlaceWizard] Place created successfully: {
  id: "<placeId>",
  cityId: "<cityId>",
  districtAutoId: "<districtId>",
  metroAutoId: "<metroId>",
  metroAutoDistanceM: 450
}
```

### 6. Expected Result
✅ Place is created with:
- cityId set to Minsk
- districtAutoId set to a district
- metroAutoId set to nearest metro station
- metroAutoDistanceM set to distance in meters

## Troubleshooting

### Issue: hasAddressJson is false
**Cause:** PlaceLocationPicker isn't passing addressJson to parent

**Fix:** Check that PlaceSearchInput is calling onSelect with addressJson

### Issue: No "Running geo enrichment" log
**Cause:** Place was created without lat/lng

**Fix:** Verify location data is in localDraft before saving

### Issue: cityId is null after enrichment
**Cause:** CityResolver couldn't match city name

**Fix:** 
1. Check City.googleName in database matches extracted city name
2. Check City.name matches extracted city name (case-insensitive)
3. Add debug logging to cityResolver to see extracted city name

### Issue: districtAutoId is null
**Cause:** No districts found for city, or no centroids set

**Fix:**
1. Verify District records exist for the city
2. Verify District.centerLat and centerLng are set
3. Check logs for "No districts with centroids found"

### Issue: metroAutoId is null
**Cause:** City has no metro, or no stations within radius

**Fix:**
1. Verify City.hasMetro is true
2. Verify MetroStation records exist for the city
3. Check if coordinates are within 4km of any station
4. Check logs for "City has no metro" or "No metro station within Xm"

## Database Verification

### Check City Data
```sql
SELECT id, name, googleName, slug, hasMetro, centerLat, centerLng
FROM "City"
WHERE slug = 'minsk';
```

Expected:
- name: "Минск"
- googleName: "Minsk" or "Минск"
- hasMetro: true
- centerLat, centerLng: ~53.9, ~27.5

### Check District Data
```sql
SELECT d.id, d.name, d.centerLat, d.centerLng, c.name as city_name
FROM "District" d
JOIN "City" c ON d."cityId" = c.id
WHERE c.slug = 'minsk'
LIMIT 5;
```

Expected: Multiple districts with centerLat/centerLng set

### Check Metro Data
```sql
SELECT m.id, m.name, m.lat, m.lng, c.name as city_name
FROM "MetroStation" m
JOIN "City" c ON m."cityId" = c.id
WHERE c.slug = 'minsk'
LIMIT 5;
```

Expected: Multiple metro stations with lat/lng set

## Manual Testing Scenarios

### Scenario 1: Google Autocomplete (High Confidence)
1. Select address from Google autocomplete
2. Expected: cityId resolved from addressJson with high confidence
3. Expected: districtAutoId and metroAutoId computed

### Scenario 2: Manual Pin (Medium Confidence)
1. Click "Указать на карте"
2. Drop pin in Minsk
3. Expected: cityId resolved by coordinates with medium confidence
4. Expected: districtAutoId and metroAutoId computed

### Scenario 3: City Without Metro
1. Select address in city without metro (if available)
2. Expected: cityId resolved
3. Expected: districtAutoId computed
4. Expected: metroAutoId and metroAutoDistanceM are null

### Scenario 4: Address Persistence
1. Select address on Step 2
2. Go to Step 3
3. Go back to Step 2
4. Expected: Address still shown in input
5. Expected: Map pin still at correct location
6. Expected: Geo data still displayed

## Success Criteria

✅ All log messages appear in correct order
✅ cityId is resolved and saved
✅ districtAutoId is computed (if districts exist)
✅ metroAutoId is computed (if city has metro)
✅ Enriched data is returned to client
✅ UI displays city, district, and metro information
✅ Address persists when navigating between steps
