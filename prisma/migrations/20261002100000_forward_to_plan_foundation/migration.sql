-- CreateEnum
CREATE TYPE "PlanItemSource" AS ENUM ('CATALOG', 'TELEGRAM_FORWARD', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanEntryType" AS ENUM ('EVENT', 'ACTIVITY', 'TASK');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('BRING', 'PAY', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'DRAFT_READY', 'CONFIRMED', 'DISCARDED', 'FAILED');

-- CreateEnum
CREATE TYPE "InboxSourceKind" AS ENUM ('TEXT', 'FORWARD', 'PHOTO');

-- CreateEnum
CREATE TYPE "InboxIntent" AS ENUM ('CREATE', 'UPDATE', 'CANCEL', 'NONE');

-- CreateEnum
CREATE TYPE "InboxPartKind" AS ENUM ('TEXT', 'PHOTO');

-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN     "arriveAt" TIMESTAMP(3),
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "childId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "dueHasTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "entryType" "PlanEntryType",
ADD COLUMN     "inboxItemId" TEXT,
ADD COLUMN     "locationText" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priceAmount" DECIMAL(10,2),
ADD COLUMN     "priceCurrency" TEXT DEFAULT 'BYN',
ADD COLUMN     "source" "PlanItemSource" NOT NULL DEFAULT 'CATALOG',
ADD COLUMN     "venuePlaceId" TEXT;

-- CreateTable
CREATE TABLE "PlanItemRequirement" (
    "id" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "text" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "dueHasTime" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'BYN',
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanItemRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramChatId" BIGINT NOT NULL,
    "mediaGroupId" TEXT,
    "sourceKind" "InboxSourceKind" NOT NULL,
    "anchorAt" TIMESTAMP(3) NOT NULL,
    "anchorIsForward" BOOLEAN NOT NULL,
    "debounceUntil" TIMESTAMP(3) NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'RECEIVED',
    "intent" "InboxIntent",
    "draft" JSONB,
    "draftVersion" INTEGER NOT NULL DEFAULT 0,
    "matchedPlanItemId" TEXT,
    "cardMessageId" INTEGER,
    "awaitingEditUntil" TIMESTAMP(3),
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "ruleCodes" TEXT[],
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "error" TEXT,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItemPart" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT NOT NULL,
    "telegramUpdateId" BIGINT NOT NULL,
    "telegramMessageId" INTEGER NOT NULL,
    "kind" "InboxPartKind" NOT NULL,
    "text" TEXT,
    "telegramFileId" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxItemPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanItemRequirement_planItemId_idx" ON "PlanItemRequirement"("planItemId");

-- CreateIndex
CREATE INDEX "PlanItemRequirement_dueAt_doneAt_idx" ON "PlanItemRequirement"("dueAt", "doneAt");

-- CreateIndex
CREATE INDEX "InboxItem_userId_status_idx" ON "InboxItem"("userId", "status");

-- CreateIndex
CREATE INDEX "InboxItem_mediaGroupId_idx" ON "InboxItem"("mediaGroupId");

-- CreateIndex
CREATE INDEX "InboxItem_status_debounceUntil_idx" ON "InboxItem"("status", "debounceUntil");

-- CreateIndex
CREATE UNIQUE INDEX "InboxItemPart_telegramUpdateId_key" ON "InboxItemPart"("telegramUpdateId");

-- CreateIndex
CREATE INDEX "InboxItemPart_inboxItemId_idx" ON "InboxItemPart"("inboxItemId");

-- CreateIndex
CREATE INDEX "PlanItem_userId_source_startsAt_idx" ON "PlanItem"("userId", "source", "startsAt");

-- CreateIndex
CREATE INDEX "PlanItem_childId_idx" ON "PlanItem"("childId");

-- CreateIndex
CREATE INDEX "PlanItem_venuePlaceId_idx" ON "PlanItem"("venuePlaceId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_venuePlaceId_fkey" FOREIGN KEY ("venuePlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItemRequirement" ADD CONSTRAINT "PlanItemRequirement_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItemPart" ADD CONSTRAINT "InboxItemPart_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
