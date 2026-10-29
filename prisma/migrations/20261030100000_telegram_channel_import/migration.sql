-- Telegram channel import (docs/engineering/telegram-channels-import-spec.md).
-- Additive only: two enum values, three ImportSource settings, one
-- ImportedRecord parent link, three ImportRun model-usage counters.
-- Written by hand: `prisma migrate dev` is not used in this repo (see CLAUDE.md).

-- AlterEnum
ALTER TYPE "ImportSourceType" ADD VALUE IF NOT EXISTS 'TELEGRAM_CHANNEL';

-- AlterEnum
ALTER TYPE "ImportFetchStrategy" ADD VALUE IF NOT EXISTS 'TELEGRAM_WEB_PREVIEW';

-- AlterTable
ALTER TABLE "ImportSource"
  ADD COLUMN "runIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "isOrganizerSource" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiCallBudgetPerRun" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "ImportedRecord" ADD COLUMN "parentRecordId" TEXT;

-- AlterTable
ALTER TABLE "ImportRun"
  ADD COLUMN "aiCalls" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "aiTokensIn" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "aiTokensOut" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ImportedRecord_parentRecordId_idx" ON "ImportedRecord"("parentRecordId");
