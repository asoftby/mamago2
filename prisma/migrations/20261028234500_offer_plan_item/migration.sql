ALTER TABLE "PlanItem" ADD COLUMN "offerId" TEXT;
CREATE INDEX "PlanItem_offerId_idx" ON "PlanItem"("offerId");
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
