-- AlterTable
ALTER TABLE "ImportSource" ADD COLUMN     "categoryTypeIdAllowlist" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
