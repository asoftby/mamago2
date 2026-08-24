-- AlterTable
ALTER TABLE "SearchQueryLog" ADD COLUMN     "searchId" TEXT,
ADD COLUMN     "clickedPosition" INTEGER,
ADD COLUMN     "clickedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "SearchQueryLog_searchId_key" ON "SearchQueryLog"("searchId");
