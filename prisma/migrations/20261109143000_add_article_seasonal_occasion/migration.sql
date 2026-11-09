-- Optional article-to-occasion classification, with approval bound to one calendar season.
ALTER TABLE "Article"
  ADD COLUMN "occasionId" TEXT,
  ADD COLUMN "seasonReviewedForStart" TIMESTAMP(3);

CREATE INDEX "Article_occasionId_idx" ON "Article"("occasionId");

ALTER TABLE "Article"
  ADD CONSTRAINT "Article_occasionId_fkey"
  FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
