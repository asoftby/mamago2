-- AlterTable
-- Add marketingEmailsEnabled flag to User table
-- Default: true (users are opted-in by default)
-- Purpose: Allow users to unsubscribe from marketing emails (newsletters, promos, digests)
-- Note: Transactional emails (verify, reset) are not affected by this flag
ALTER TABLE "User" ADD COLUMN "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;
