-- Add explicit SEO policy and moderation state without changing existing tag IDs, slugs or links.
CREATE TYPE "DiscoveryTagIndexingMode" AS ENUM ('AUTO', 'INDEX', 'NOINDEX');
CREATE TYPE "DiscoveryTagReviewStatus" AS ENUM ('APPROVED', 'PENDING');

ALTER TABLE "DiscoveryTag"
  ADD COLUMN "indexingMode" "DiscoveryTagIndexingMode" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "reviewStatus" "DiscoveryTagReviewStatus" NOT NULL DEFAULT 'APPROVED';

CREATE TYPE "DiscoveryTagGroup" AS ENUM ('PLACES', 'ENTERTAINMENT', 'INTERESTS', 'DEVELOPMENT', 'CELEBRATIONS', 'FAMILY', 'TRAVEL', 'OTHER');
ALTER TABLE "DiscoveryTag" ADD COLUMN "group" "DiscoveryTagGroup" NOT NULL DEFAULT 'OTHER';

-- Existing editorial tags keep their identity and URLs; assign only known topic groups.
UPDATE "DiscoveryTag" SET "group" = CASE
  WHEN "slug" = 'novye-mesta' THEN 'PLACES'::"DiscoveryTagGroup"
  WHEN "slug" IN ('kultura-i-iskusstvo', 'tsirk-i-fokusy') THEN 'ENTERTAINMENT'::"DiscoveryTagGroup"
  WHEN "slug" = 'zhivotnye' THEN 'INTERESTS'::"DiscoveryTagGroup"
  WHEN "slug" = 'krasota-i-stil' THEN 'FAMILY'::"DiscoveryTagGroup"
  ELSE "group" END
WHERE "slug" IN ('novye-mesta', 'kultura-i-iskusstvo', 'tsirk-i-fokusy', 'zhivotnye', 'krasota-i-stil');
