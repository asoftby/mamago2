-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "genreSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
