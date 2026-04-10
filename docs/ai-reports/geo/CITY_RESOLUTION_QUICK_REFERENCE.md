# City Resolution - Quick Reference

## How It Works

**Coordinates → City → District + Metro**

1. User selects address OR drops pin
2. System gets lat/lng coordinates
3. Calculate distance to all city centers
4. Match nearest city within radiusKm
5. Compute district and metro for that city

## Resolution Priority

1. **Coordinates** (PRIMARY) - Always trusted
2. **Address parsing** (HELPER) - For validation only
3. **Manual selection** (FALLBACK) - When no match

## Database Setup

```sql
-- For each city, set these 3 fields:
UPDATE "City" 
SET 
  "centerLat" = 53.9,    -- City center latitude
  "centerLng" = 27.5,    -- City center longitude
  "radiusKm" = 40        -- Search radius in km
WHERE slug = 'minsk';
```

## Radius Guidelines

- **Large cities** (Minsk): 40-50km
- **Medium cities** (Gomel): 25-35km
- **Small cities**: 15-25km
- Include suburbs in radius

## Testing

```bash
# 1. Setup database
psql -d mamago2 -f scripts/db/setup-city-coordinates.sql

# 2. Test in UI
# - Select Minsk address → cityId = Minsk ✅
# - Drop pin in Minsk → cityId = Minsk ✅
# - Drop pin in Gomel → cityId = Gomel ✅
# - Drop pin nowhere → cityId = null ✅
```

## Debugging

### Check City Data
```sql
SELECT name, "centerLat", "centerLng", "radiusKm"
FROM "City"
WHERE "centerLat" IS NOT NULL;
```

### Check Place Resolution
```sql
SELECT 
  p.title,
  p.lat,
  p.lng,
  c.name as city
FROM "Place" p
LEFT JOIN "City" c ON p."cityId" = c.id
WHERE p.id = '<place_id>';
```

### Check Console Logs
```
[cityResolver] Минск: 2.34km (radius: 40km)
[cityResolver] ✅ Matched city by coordinates: Минск
```

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| cityId is null | No city coordinates | Run setup script |
| Wrong city | Overlapping radii | Adjust radiusKm |
| No district/metro | cityId is null | Fix city resolution first |

## API Response

```json
{
  "cityId": "clxxx",
  "cityName": "Минск",
  "confidence": "high",
  "shouldUpdate": true
}
```

## Files

- **Service**: `src/services/place/cityResolver.service.ts`
- **Schema**: `prisma/schema.prisma` (City model)
- **Setup**: `scripts/db/setup-city-coordinates.sql`
- **Docs**: `CITY_COORDINATE_RESOLUTION_COMPLETE.md`
- **Testing**: `CITY_RESOLUTION_TESTING_GUIDE.md`
