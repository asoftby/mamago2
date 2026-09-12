-- AlterTable
ALTER TABLE "ActivitySession" ADD COLUMN     "buyUrl" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "isSaleOpen" BOOLEAN,
ADD COLUMN     "priceMaxCents" INTEGER,
ADD COLUMN     "priceMinCents" INTEGER,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ActivitySession_source_externalId_key" ON "ActivitySession"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_source_externalId_key" ON "Place"("source", "externalId");
