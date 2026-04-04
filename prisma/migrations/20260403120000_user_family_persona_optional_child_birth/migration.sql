-- AlterTable
ALTER TABLE "User" ADD COLUMN "familyRole" TEXT,
ADD COLUMN "ageBandLabel" TEXT,
ADD COLUMN "preferenceSummary" TEXT,
ADD COLUMN "leisureFormatSummary" TEXT;

-- AlterTable
ALTER TABLE "Child" ALTER COLUMN "birthDate" DROP NOT NULL;
