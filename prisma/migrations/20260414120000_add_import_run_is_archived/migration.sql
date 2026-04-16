-- AlterTable
ALTER TABLE "ImportRun" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ImportRun_isArchived_idx" ON "ImportRun"("isArchived");
