-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "campProgramType" TEXT,
ADD COLUMN     "accommodationAddress" TEXT,
ADD COLUMN     "accommodationRooms" TEXT,
ADD COLUMN     "campIncludedMeals" JSONB,
ADD COLUMN     "campSafetyInfo" TEXT,
ADD COLUMN     "campMedicalInfo" TEXT;
