-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "discoverySignalIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
