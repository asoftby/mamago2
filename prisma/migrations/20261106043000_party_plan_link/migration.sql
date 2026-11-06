ALTER TABLE "PartyOrder" ADD COLUMN "selectedChildId" TEXT;
CREATE UNIQUE INDEX "PartyOrder_planItemId_key" ON "PartyOrder"("planItemId");
ALTER TABLE "PartyOrder" ADD CONSTRAINT "PartyOrder_planItemId_fkey"
  FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
