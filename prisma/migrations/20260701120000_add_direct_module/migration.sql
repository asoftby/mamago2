-- Direct module (Phase 1 — Core)
-- Adds DirectThread / DirectMessage / DirectComplaint and related enums.
-- Generated via `prisma migrate diff --from-url ... --to-schema-datamodel`,
-- manually trimmed to remove unrelated drift (pre-existing partial unique
-- indexes on `*_cityId_slug_key` and Article FK definitions — see CLAUDE.md
-- note on migration 20260608114243_city_scoped_slugs; not touched here).

-- CreateEnum
CREATE TYPE "DirectThreadStatus" AS ENUM ('OPEN', 'CLOSED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DirectActorType" AS ENUM ('CUSTOMER', 'BUSINESS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DirectComplaintStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "NotificationEntityType" ADD VALUE 'DIRECT_THREAD';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "NotificationType" ADD VALUE 'DIRECT_THREAD_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'DIRECT_MESSAGE_RECEIVED';

-- CreateTable
CREATE TABLE "DirectThread" (
    "id" TEXT NOT NULL,
    "threadNumber" SERIAL NOT NULL,
    "publicationType" "PublicationType" NOT NULL,
    "offerId" TEXT,
    "activityId" TEXT,
    "placeId" TEXT,
    "businessId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "bookingRequestId" TEXT,
    "status" "DirectThreadStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageBy" "DirectActorType",
    "blockedAt" TIMESTAMP(3),
    "blockedByUserId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectThread_pkey" PRIMARY KEY ("id")
);

-- Display format is "D-{threadNumber}" (e.g. D-10253); start above 10000 so
-- the first real thread doesn't read as "D-1".
ALTER SEQUENCE "DirectThread_threadNumber_seq" RESTART WITH 10000;

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderType" "DirectActorType" NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenByUserId" TEXT,
    "hiddenReason" TEXT,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectComplaint" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" "DirectComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "DirectComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectThread_threadNumber_key" ON "DirectThread"("threadNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DirectThread_bookingRequestId_key" ON "DirectThread"("bookingRequestId");

-- CreateIndex
CREATE INDEX "DirectThread_businessId_status_lastMessageAt_idx" ON "DirectThread"("businessId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "DirectThread_customerUserId_status_lastMessageAt_idx" ON "DirectThread"("customerUserId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "DirectThread_offerId_idx" ON "DirectThread"("offerId");

-- CreateIndex
CREATE INDEX "DirectThread_activityId_idx" ON "DirectThread"("activityId");

-- CreateIndex
CREATE INDEX "DirectThread_placeId_idx" ON "DirectThread"("placeId");

-- CreateIndex
CREATE INDEX "DirectThread_status_idx" ON "DirectThread"("status");

-- CreateIndex
CREATE INDEX "DirectThread_createdAt_idx" ON "DirectThread"("createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_threadId_createdAt_idx" ON "DirectMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_senderUserId_idx" ON "DirectMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "DirectMessage_threadId_readAt_idx" ON "DirectMessage"("threadId", "readAt");

-- CreateIndex
CREATE INDEX "DirectComplaint_threadId_idx" ON "DirectComplaint"("threadId");

-- CreateIndex
CREATE INDEX "DirectComplaint_reporterUserId_idx" ON "DirectComplaint"("reporterUserId");

-- CreateIndex
CREATE INDEX "DirectComplaint_status_idx" ON "DirectComplaint"("status");

-- CreateIndex
CREATE INDEX "DirectComplaint_createdAt_idx" ON "DirectComplaint"("createdAt");

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_blockedByUserId_fkey" FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectThread" ADD CONSTRAINT "DirectThread_hiddenByUserId_fkey" FOREIGN KEY ("hiddenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DirectThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_hiddenByUserId_fkey" FOREIGN KEY ("hiddenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectComplaint" ADD CONSTRAINT "DirectComplaint_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DirectThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectComplaint" ADD CONSTRAINT "DirectComplaint_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectComplaint" ADD CONSTRAINT "DirectComplaint_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
