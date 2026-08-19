ALTER TABLE "Offer"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedByUserId" TEXT,
ADD COLUMN "archiveReason" TEXT;

CREATE INDEX "Offer_archivedAt_idx" ON "Offer"("archivedAt");
CREATE INDEX "Offer_archivedByUserId_idx" ON "Offer"("archivedByUserId");
CREATE INDEX "Offer_status_archivedAt_idx" ON "Offer"("status", "archivedAt");

ALTER TABLE "Offer"
ADD CONSTRAINT "Offer_archivedByUserId_fkey"
FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
