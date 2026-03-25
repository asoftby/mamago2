-- AlterTable
ALTER TABLE "SignalDefinition" ADD COLUMN     "titleEn" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SignalDefinition" ADD COLUMN     "icon" TEXT;
ALTER TABLE "SignalDefinition" ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SignalDefinition" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "SignalDefinition_order_idx" ON "SignalDefinition"("order");

-- CreateIndex
CREATE INDEX "SignalDefinition_parentId_order_idx" ON "SignalDefinition"("parentId", "order");

-- AddForeignKey
ALTER TABLE "SignalDefinition" ADD CONSTRAINT "SignalDefinition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SignalDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
