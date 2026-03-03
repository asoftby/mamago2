-- CreateEnum
CREATE TYPE "BusinessVerificationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" "BusinessVerificationStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "BusinessVerificationLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "statusFrom" "BusinessVerificationStatus" NOT NULL,
    "statusTo" "BusinessVerificationStatus" NOT NULL,
    "note" TEXT,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessVerificationLog_businessId_createdAt_idx" ON "BusinessVerificationLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Business_verificationStatus_idx" ON "Business"("verificationStatus");

-- AddForeignKey
ALTER TABLE "BusinessVerificationLog" ADD CONSTRAINT "BusinessVerificationLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessVerificationLog" ADD CONSTRAINT "BusinessVerificationLog_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
