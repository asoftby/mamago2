-- CreateEnum
CREATE TYPE "BusinessAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO');

-- CreateEnum
CREATE TYPE "BusinessAccessRequesterRole" AS ENUM ('OWNER', 'DIRECTOR', 'MARKETER', 'MANAGER', 'OTHER');

-- CreateTable
CREATE TABLE "BusinessAccessRequest" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "unp" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "requesterRole" "BusinessAccessRequesterRole" NOT NULL,
  "comment" TEXT,
  "status" "BusinessAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "reviewedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BusinessAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessAccessRequest_businessId_idx" ON "BusinessAccessRequest"("businessId");

-- CreateIndex
CREATE INDEX "BusinessAccessRequest_requesterUserId_idx" ON "BusinessAccessRequest"("requesterUserId");

-- CreateIndex
CREATE INDEX "BusinessAccessRequest_status_idx" ON "BusinessAccessRequest"("status");

-- CreateIndex
CREATE INDEX "BusinessAccessRequest_unp_idx" ON "BusinessAccessRequest"("unp");

-- AddForeignKey
ALTER TABLE "BusinessAccessRequest" ADD CONSTRAINT "BusinessAccessRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAccessRequest" ADD CONSTRAINT "BusinessAccessRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAccessRequest" ADD CONSTRAINT "BusinessAccessRequest_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
