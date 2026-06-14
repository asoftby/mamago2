-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "createRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Offer_createRequestId_key" ON "Offer"("createRequestId");
