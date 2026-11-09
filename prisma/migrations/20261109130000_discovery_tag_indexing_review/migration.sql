-- Add explicit SEO policy and moderation state without changing existing tag IDs, slugs or links.
CREATE TYPE "DiscoveryTagIndexingMode" AS ENUM ('AUTO', 'INDEX', 'NOINDEX');
CREATE TYPE "DiscoveryTagReviewStatus" AS ENUM ('APPROVED', 'PENDING');

ALTER TABLE "DiscoveryTag"
  ADD COLUMN "indexingMode" "DiscoveryTagIndexingMode" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "reviewStatus" "DiscoveryTagReviewStatus" NOT NULL DEFAULT 'APPROVED';
