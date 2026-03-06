/*
  Warnings:

  - The values [NEEDS_CHANGES] on the enum `ModerationAction` will be removed. If these variants are still used in the database, this will fail.

*/
-- Update existing NEEDS_CHANGES values to NEEDS_REVISION before enum change
UPDATE "ModerationLog" SET "action" = 'SUBMIT' WHERE "action" = 'NEEDS_CHANGES';

-- AlterEnum
BEGIN;
CREATE TYPE "ModerationAction_new" AS ENUM ('SUBMIT', 'APPROVE', 'NEEDS_REVISION', 'REJECT');
ALTER TABLE "ModerationLog" ALTER COLUMN "action" TYPE "ModerationAction_new" USING ("action"::text::"ModerationAction_new");
ALTER TYPE "ModerationAction" RENAME TO "ModerationAction_old";
ALTER TYPE "ModerationAction_new" RENAME TO "ModerationAction";
DROP TYPE "public"."ModerationAction_old";
COMMIT;
