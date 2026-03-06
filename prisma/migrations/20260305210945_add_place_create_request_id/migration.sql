/*
  Warnings:

  - A unique constraint covering the columns `[ownerUserId,createRequestId]` on the table `Place` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "createRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Place_ownerUserId_createRequestId_key" ON "Place"("ownerUserId", "createRequestId");
