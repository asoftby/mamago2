-- AlterEnum
ALTER TYPE "BusinessVerificationStatus" ADD VALUE 'NEEDS_INFO';

-- DropForeignKey
ALTER TABLE "PlanItem" DROP CONSTRAINT "PlanItem_activityId_fkey";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PlanItem" ALTER COLUMN "activityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
