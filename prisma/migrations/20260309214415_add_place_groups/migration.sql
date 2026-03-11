-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "placeGroupId" TEXT;

-- CreateTable
CREATE TABLE "PlaceGroup" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaceGroup_ownerUserId_idx" ON "PlaceGroup"("ownerUserId");

-- CreateIndex
CREATE INDEX "Place_placeGroupId_idx" ON "Place"("placeGroupId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_placeGroupId_fkey" FOREIGN KEY ("placeGroupId") REFERENCES "PlaceGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
