-- Direct module — Phase 1.1 (Architecture Polish)
-- Generated via `prisma migrate diff --from-url ... --to-schema-datamodel`,
-- manually trimmed/adjusted:
--   - Removed unrelated drift on `*_cityId_slug_key` partial unique indexes
--     and Article FK definitions (see CLAUDE.md note on migration
--     20260608114243_city_scoped_slugs — not touched here).
--   - Replaced Prisma's generated enum-rename (create-new-type, cast all
--     dependent columns, swap, drop-old) with a plain
--     `ALTER TYPE ... RENAME VALUE`, since DIRECT_MESSAGE_RECEIVED has never
--     been written to any row yet (notifyDirectMessage() is boundary-only,
--     not wired into any caller) — a metadata-only rename is equivalent here
--     and far cheaper/safer than rewriting three dependent columns.

-- CreateEnum
CREATE TYPE "DirectMessageHiddenReason" AS ENUM ('SPAM', 'ABUSE', 'SCAM', 'OFFTOPIC', 'OTHER');

-- AlterEnum
ALTER TYPE "DirectActorType" ADD VALUE 'ADMIN';

-- AlterEnum
ALTER TYPE "DirectComplaintStatus" ADD VALUE 'ACTION_TAKEN';

-- AlterEnum
ALTER TYPE "DirectThreadStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum (rename, no rows reference the old value yet)
ALTER TYPE "NotificationType" RENAME VALUE 'DIRECT_MESSAGE_RECEIVED' TO 'DIRECT_NEW_MESSAGE';

-- AlterTable
ALTER TABLE "DirectComplaint" ADD COLUMN "resolution" TEXT;

-- AlterTable
ALTER TABLE "DirectMessage" DROP COLUMN "hiddenReason",
ADD COLUMN "hiddenReason" "DirectMessageHiddenReason";

-- AlterTable
ALTER TABLE "DirectThread" ADD COLUMN "completedAt" TIMESTAMP(3);
