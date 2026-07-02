-- CreateEnum
CREATE TYPE "DirectCommunicationMode" AS ENUM ('CONTACTS_ONLY', 'DIRECT_ONLY', 'DIRECT_AND_CONTACTS', 'EXTERNAL_BOOKING');

-- CreateEnum
CREATE TYPE "DirectContactVisibility" AS ENUM ('ALWAYS', 'AFTER_FIRST_REQUEST', 'AFTER_BUSINESS_CONFIRMATION', 'NEVER');

-- CreateTable
CREATE TABLE "DirectPlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "publicationTypePolicy" JSONB NOT NULL,
    "allowBusinessReopenAfterCompletion" BOOLEAN NOT NULL DEFAULT false,
    "contactVisibility" "DirectContactVisibility" NOT NULL DEFAULT 'ALWAYS',
    "autoCloseDays" INTEGER,
    "autoArchiveDays" INTEGER,
    "floodMessageCount" INTEGER NOT NULL DEFAULT 5,
    "floodIntervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "floodLockMinutes" INTEGER NOT NULL DEFAULT 10,
    "noReplyCapCount" INTEGER NOT NULL DEFAULT 3,
    "contactDetectPhone" BOOLEAN NOT NULL DEFAULT true,
    "contactDetectEmail" BOOLEAN NOT NULL DEFAULT true,
    "contactDetectLink" BOOLEAN NOT NULL DEFAULT true,
    "contactDetectTelegram" BOOLEAN NOT NULL DEFAULT true,
    "contactDetectWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "contactDetectInstagram" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "DirectPlatformSettings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DirectPlatformSettings" ADD CONSTRAINT "DirectPlatformSettings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
