-- CreateEnum
CREATE TYPE "ActivitySchedulingKind" AS ENUM ('SLOT', 'WINDOW');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "schedulingKind" "ActivitySchedulingKind";
