-- AlterTable
ALTER TABLE "EventCategory" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "EventCategory_parentId_idx" ON "EventCategory"("parentId");

-- CreateIndex
CREATE INDEX "EventCategory_parentId_sortOrder_idx" ON "EventCategory"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "EventCategory" ADD CONSTRAINT "EventCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EventCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
