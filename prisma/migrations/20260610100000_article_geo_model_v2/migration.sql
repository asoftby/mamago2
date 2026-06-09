-- Migration: article_related_place
--
-- Adds Article.relatedPlaceId — a nullable FK to Place that records which place/venue
-- an article is about (editorial context only).
-- Does NOT drive geoScope or cityId.  On DELETE SET NULL keeps the article intact.

ALTER TABLE "Article"
  ADD COLUMN IF NOT EXISTS "relatedPlaceId" TEXT;

-- FK: ON DELETE SET NULL
DO $$ BEGIN
  ALTER TABLE "Article"
    ADD CONSTRAINT "Article_relatedPlaceId_fkey"
    FOREIGN KEY ("relatedPlaceId") REFERENCES "Place"(id) ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "Article" VALIDATE CONSTRAINT "Article_relatedPlaceId_fkey";

CREATE INDEX IF NOT EXISTS "Article_relatedPlaceId_idx"
  ON "Article"("relatedPlaceId");
