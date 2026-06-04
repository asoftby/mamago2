-- Add googlePlaceId and detected location fields to RouteStop
ALTER TABLE "public"."RouteStop" ADD COLUMN "googlePlaceId" TEXT;
ALTER TABLE "public"."RouteStop" ADD COLUMN "formattedAddress" TEXT;
ALTER TABLE "public"."RouteStop" ADD COLUMN "addressComponents" JSONB;
ALTER TABLE "public"."RouteStop" ADD COLUMN "rawGooglePayload" JSONB;
ALTER TABLE "public"."RouteStop" ADD COLUMN "detectedCountryCode" TEXT;
ALTER TABLE "public"."RouteStop" ADD COLUMN "detectedCountryName" TEXT;
ALTER TABLE "public"."RouteStop" ADD COLUMN "detectedCityName" TEXT;
ALTER TABLE "public"."RouteStop" ADD COLUMN "detectedRegionName" TEXT;

-- Index for googlePlaceId lookups
CREATE INDEX IF NOT EXISTS "RouteStop_googlePlaceId_idx" ON "public"."RouteStop" ("googlePlaceId");
