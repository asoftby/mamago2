-- AlterTable
ALTER TABLE "Article" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
