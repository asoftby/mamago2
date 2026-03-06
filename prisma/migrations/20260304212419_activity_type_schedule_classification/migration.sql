/*
  Warnings:

  - You are about to drop the column `name` on the `Activity` table. All the data in the column will be lost.
  - Added the required column `ownerUserId` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduleMode` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shortDesc` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EVENT', 'PERMANENT', 'COURSE', 'ROUTE', 'OFFER');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('ONE_TIME', 'MULTI_DATE', 'RECURRING', 'ON_DEMAND', 'ALWAYS');

-- AlterTable: Add new columns with defaults for existing rows
ALTER TABLE "Activity" 
ADD COLUMN "ageTags" TEXT[] DEFAULT '{}',
ADD COLUMN "coverImageId" TEXT,
ADD COLUMN "nextOccurrenceAt" TIMESTAMP(3),
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "placeId" TEXT,
ADD COLUMN "priceText" TEXT,
ADD COLUMN "priceTo" DOUBLE PRECISION,
ADD COLUMN "scheduleJson" JSONB,
ADD COLUMN "scheduleMode" "ScheduleMode",
ADD COLUMN "shortDesc" TEXT,
ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "title" TEXT,
ADD COLUMN "type" "ActivityType";

-- Migrate existing data
UPDATE "Activity" 
SET 
  "title" = COALESCE("name", 'Untitled Activity'),
  "shortDesc" = COALESCE(LEFT("description", 200), 'No description'),
  "type" = 'EVENT',
  "scheduleMode" = 'ONE_TIME',
  "ownerUserId" = COALESCE("createdBy", (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1))
WHERE "title" IS NULL;

-- Make columns required after migration
ALTER TABLE "Activity" 
ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "shortDesc" SET NOT NULL,
ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "scheduleMode" SET NOT NULL,
ALTER COLUMN "ownerUserId" SET NOT NULL;

-- Drop old column
ALTER TABLE "Activity" DROP COLUMN "name";

-- CreateTable
CREATE TABLE "ActivityImage" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityImage_activityId_sortOrder_idx" ON "ActivityImage"("activityId", "sortOrder");

-- CreateIndex
CREATE INDEX "Activity_placeId_idx" ON "Activity"("placeId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_scheduleMode_idx" ON "Activity"("scheduleMode");

-- CreateIndex
CREATE INDEX "Activity_nextOccurrenceAt_idx" ON "Activity"("nextOccurrenceAt");

-- CreateIndex
CREATE INDEX "Activity_ownerUserId_idx" ON "Activity"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityImage" ADD CONSTRAINT "ActivityImage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
