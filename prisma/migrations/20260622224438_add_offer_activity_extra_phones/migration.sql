-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneLabel" TEXT,
ADD COLUMN     "phone2" TEXT,
ADD COLUMN     "phone2Label" TEXT,
ADD COLUMN     "phone3" TEXT,
ADD COLUMN     "phone3Label" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "contactPhoneLabel" TEXT,
ADD COLUMN     "contactPhone2" TEXT,
ADD COLUMN     "contactPhone2Label" TEXT,
ADD COLUMN     "contactPhone3" TEXT,
ADD COLUMN     "contactPhone3Label" TEXT;
