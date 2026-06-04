-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "discoverySignalIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "discoverySignalIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileSignalIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
