-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leisureFormatSignalId" TEXT,
ADD COLUMN     "preferenceSignalIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
