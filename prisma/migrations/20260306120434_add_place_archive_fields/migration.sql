-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Place_archivedByUserId_idx" ON "Place"("archivedByUserId");

-- CreateIndex
CREATE INDEX "Place_archivedAt_idx" ON "Place"("archivedAt");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
