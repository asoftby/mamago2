-- CreateEnum
CREATE TYPE "ModerationEntityType" AS ENUM ('PLACE', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('SUBMIT', 'APPROVE', 'NEEDS_CHANGES', 'REJECT');

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "entityType" "ModerationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "message" TEXT,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationLog_entityType_entityId_createdAt_idx" ON "ModerationLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationLog_reviewedByUserId_idx" ON "ModerationLog"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
