/*
  Warnings:

  - A unique constraint covering the columns `[phoneE164]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "BusinessStatus" ADD VALUE 'PENDING_VERIFICATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneE164" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneE164_key" ON "User"("phoneE164");

-- CreateIndex
CREATE INDEX "User_phoneE164_idx" ON "User"("phoneE164");
