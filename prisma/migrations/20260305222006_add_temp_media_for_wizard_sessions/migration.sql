-- CreateEnum
CREATE TYPE "TempMediaKind" AS ENUM ('PLACE_LOGO', 'PLACE_GALLERY', 'ACTIVITY_COVER', 'ACTIVITY_GALLERY');

-- CreateEnum
CREATE TYPE "TempMediaStatus" AS ENUM ('TEMP', 'ATTACHED', 'DELETED');

-- CreateTable
CREATE TABLE "TempMedia" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "wizardSessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "kind" "TempMediaKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "TempMediaStatus" NOT NULL DEFAULT 'TEMP',
    "placeId" TEXT,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TempMedia_ownerUserId_wizardSessionId_status_idx" ON "TempMedia"("ownerUserId", "wizardSessionId", "status");

-- CreateIndex
CREATE INDEX "TempMedia_wizardSessionId_kind_sortOrder_idx" ON "TempMedia"("wizardSessionId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "TempMedia_status_createdAt_idx" ON "TempMedia"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TempMedia" ADD CONSTRAINT "TempMedia_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
