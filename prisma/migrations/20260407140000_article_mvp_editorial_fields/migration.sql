-- Article MVP: editorial workflow fields + cover/SEO media FKs
-- Enum extensions for journal lifecycle
ALTER TYPE "ContentStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "ContentStatus" ADD VALUE 'ARCHIVED';

-- AlterTable Article
ALTER TABLE "Article" ADD COLUMN "coverImageId" TEXT;
ALTER TABLE "Article" ADD COLUMN "authorUserId" TEXT;
ALTER TABLE "Article" ADD COLUMN "authorLabel" TEXT;
ALTER TABLE "Article" ADD COLUMN "cityContext" TEXT;
ALTER TABLE "Article" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Article" ADD COLUMN "seoImageId" TEXT;
ALTER TABLE "Article" ADD COLUMN "noindex" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Article" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Article" ADD CONSTRAINT "Article_coverImageId_fkey"
  FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_seoImageId_fkey"
  FOREIGN KEY ("seoImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Article_authorUserId_idx" ON "Article"("authorUserId");
CREATE INDEX "Article_coverImageId_idx" ON "Article"("coverImageId");
