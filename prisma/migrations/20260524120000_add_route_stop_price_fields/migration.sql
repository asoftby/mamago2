-- Add detailed per-stop pricing for route constructor
CREATE TYPE "public"."RouteStopPriceType" AS ENUM ('FREE', 'FIXED', 'RANGE', 'FROM', 'CUSTOM', 'UNKNOWN');

ALTER TABLE "public"."RouteStop"
  ADD COLUMN "priceType" "public"."RouteStopPriceType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "priceMin" DOUBLE PRECISION,
  ADD COLUMN "priceMax" DOUBLE PRECISION,
  ADD COLUMN "priceCurrency" TEXT NOT NULL DEFAULT 'BYN',
  ADD COLUMN "priceNote" TEXT;
