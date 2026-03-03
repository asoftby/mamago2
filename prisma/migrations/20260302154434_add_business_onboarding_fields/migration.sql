-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "BusinessStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "unp" TEXT;

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");
