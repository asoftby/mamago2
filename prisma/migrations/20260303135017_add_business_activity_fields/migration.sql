-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "ageLabel" TEXT,
ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "currency" TEXT DEFAULT 'BYN',
ADD COLUMN     "priceFrom" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ActivitySession" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivitySession_activityId_idx" ON "ActivitySession"("activityId");

-- CreateIndex
CREATE INDEX "ActivitySession_startsAt_idx" ON "ActivitySession"("startsAt");

-- CreateIndex
CREATE INDEX "Activity_businessId_idx" ON "Activity"("businessId");

-- CreateIndex
CREATE INDEX "Activity_cityId_idx" ON "Activity"("cityId");

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
