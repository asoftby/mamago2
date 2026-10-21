-- CreateEnum
CREATE TYPE "PartyOrderEntry" AS ENUM ('FULL', 'PART');
-- CreateEnum
CREATE TYPE "PartyPricingMode" AS ENUM ('BOOK', 'QUOTE');
-- AlterEnum
ALTER TYPE "BookingActivityType" ADD VALUE 'PREPAYMENT_MARKED';
-- AlterTable
ALTER TABLE "PartyOrder" ADD COLUMN     "entry" "PartyOrderEntry" NOT NULL DEFAULT 'FULL';
-- AlterTable
ALTER TABLE "PartyOrderItem" ADD COLUMN     "prepaidAt" TIMESTAMP(3),
ADD COLUMN     "prepaidMarkedByUserId" TEXT,
ADD COLUMN     "pricingMode" "PartyPricingMode" NOT NULL DEFAULT 'BOOK',
ADD COLUMN     "serviceEnd" TIMESTAMP(3),
ADD COLUMN     "serviceStart" TIMESTAMP(3);
-- AddForeignKey
ALTER TABLE "PartyOrderItem" ADD CONSTRAINT "PartyOrderItem_prepaidMarkedByUserId_fkey" FOREIGN KEY ("prepaidMarkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
