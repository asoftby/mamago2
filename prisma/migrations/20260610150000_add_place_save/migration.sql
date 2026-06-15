-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN "placeId" TEXT,
ADD COLUMN "planPlaceSlug" TEXT;

-- CreateTable
CREATE TABLE "PlaceIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanItem_placeId_idx" ON "PlanItem"("placeId");

-- CreateIndex
CREATE INDEX "PlanItem_userId_planPlaceSlug_idx" ON "PlanItem"("userId", "planPlaceSlug");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceIdea_userId_placeId_key" ON "PlaceIdea"("userId", "placeId");

-- CreateIndex
CREATE INDEX "PlaceIdea_userId_idx" ON "PlaceIdea"("userId");

-- CreateIndex
CREATE INDEX "PlaceIdea_placeId_idx" ON "PlaceIdea"("placeId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceIdea" ADD CONSTRAINT "PlaceIdea_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceIdea" ADD CONSTRAINT "PlaceIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
