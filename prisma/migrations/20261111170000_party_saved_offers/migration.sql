-- Save-only references; not included in party booking or cost calculation.
CREATE TABLE "PartySavedOffer" (
  "id" TEXT NOT NULL,
  "partyOrderId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartySavedOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartySavedOffer_partyOrderId_offerId_key" ON "PartySavedOffer"("partyOrderId", "offerId");
CREATE INDEX "PartySavedOffer_offerId_idx" ON "PartySavedOffer"("offerId");
ALTER TABLE "PartySavedOffer" ADD CONSTRAINT "PartySavedOffer_partyOrderId_fkey"
  FOREIGN KEY ("partyOrderId") REFERENCES "PartyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartySavedOffer" ADD CONSTRAINT "PartySavedOffer_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
