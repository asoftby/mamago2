-- CreateEnum
CREATE TYPE "BusinessUnpVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'NAME_MISMATCH', 'INACTIVE', 'NOT_FOUND', 'LOOKUP_FAILED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "unpLastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "unpOfficialName" TEXT,
ADD COLUMN     "unpVerificationStatus" "BusinessUnpVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "unpVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Business_unpVerificationStatus_idx" ON "Business"("unpVerificationStatus");
