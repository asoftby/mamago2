-- CreateEnum
CREATE TYPE "SeoCanonicalSource" AS ENUM ('AUTO', 'MANUAL', 'FALLBACK');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "seoCanonicalSource" "SeoCanonicalSource" NOT NULL DEFAULT 'FALLBACK';
ALTER TABLE "Place" ADD COLUMN "seoCanonicalSource" "SeoCanonicalSource" NOT NULL DEFAULT 'FALLBACK';
ALTER TABLE "Offer" ADD COLUMN "seoCanonicalSource" "SeoCanonicalSource" NOT NULL DEFAULT 'FALLBACK';
ALTER TABLE "Route" ADD COLUMN "seoCanonicalSource" "SeoCanonicalSource" NOT NULL DEFAULT 'FALLBACK';
ALTER TABLE "Article" ADD COLUMN "seoCanonicalSource" "SeoCanonicalSource" NOT NULL DEFAULT 'FALLBACK';

-- Existing non-empty canonical → treat as manual overrides
UPDATE "Activity" SET "seoCanonicalSource" = 'MANUAL' WHERE "seoCanonicalUrl" IS NOT NULL AND trim("seoCanonicalUrl") <> '';
UPDATE "Place" SET "seoCanonicalSource" = 'MANUAL' WHERE "seoCanonicalUrl" IS NOT NULL AND trim("seoCanonicalUrl") <> '';
UPDATE "Offer" SET "seoCanonicalSource" = 'MANUAL' WHERE "seoCanonicalUrl" IS NOT NULL AND trim("seoCanonicalUrl") <> '';
UPDATE "Route" SET "seoCanonicalSource" = 'MANUAL' WHERE "seoCanonicalUrl" IS NOT NULL AND trim("seoCanonicalUrl") <> '';
UPDATE "Article" SET "seoCanonicalSource" = 'MANUAL' WHERE "seoCanonicalUrl" IS NOT NULL AND trim("seoCanonicalUrl") <> '';
