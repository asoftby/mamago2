-- Setup City Coordinates for Coordinate-Based Resolution
-- Run this script to populate centerLat, centerLng, and radiusKm for cities

-- Minsk (Belarus capital)
UPDATE "City" 
SET 
  "centerLat" = 53.9,
  "centerLng" = 27.5,
  "radiusKm" = 40,
  "googleName" = 'Minsk'
WHERE slug = 'minsk';

-- Gomel (Belarus second largest city)
UPDATE "City" 
SET 
  "centerLat" = 52.4345,
  "centerLng" = 30.9754,
  "radiusKm" = 30,
  "googleName" = 'Gomel'
WHERE slug = 'gomel';

-- Mogilev (Belarus third largest city)
UPDATE "City" 
SET 
  "centerLat" = 53.9007,
  "centerLng" = 30.3313,
  "radiusKm" = 25,
  "googleName" = 'Mogilev'
WHERE slug = 'mogilev';

-- Vitebsk (Belarus fourth largest city)
UPDATE "City" 
SET 
  "centerLat" = 55.1904,
  "centerLng" = 30.2049,
  "radiusKm" = 25,
  "googleName" = 'Vitebsk'
WHERE slug = 'vitebsk';

-- Grodno (Belarus fifth largest city)
UPDATE "City" 
SET 
  "centerLat" = 53.6884,
  "centerLng" = 23.8258,
  "radiusKm" = 25,
  "googleName" = 'Grodno'
WHERE slug = 'grodno';

-- Brest (Belarus sixth largest city)
UPDATE "City" 
SET 
  "centerLat" = 52.0976,
  "centerLng" = 23.7340,
  "radiusKm" = 25,
  "googleName" = 'Brest'
WHERE slug = 'brest';

-- Verify the updates
SELECT 
  name,
  slug,
  "centerLat",
  "centerLng",
  "radiusKm",
  "googleName",
  "hasMetro"
FROM "City"
WHERE "centerLat" IS NOT NULL
ORDER BY name;

-- Check for cities missing coordinates
SELECT 
  name,
  slug,
  "centerLat",
  "centerLng",
  "radiusKm"
FROM "City"
WHERE "centerLat" IS NULL OR "centerLng" IS NULL OR "radiusKm" IS NULL
ORDER BY name;
