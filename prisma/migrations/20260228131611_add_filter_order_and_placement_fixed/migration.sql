-- CreateEnum
CREATE TYPE "UiPlacement" AS ENUM ('PRIMARY', 'SECONDARY', 'HIDDEN');

-- AlterTable
ALTER TABLE "FilterDefinition" ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "placement" "UiPlacement" NOT NULL DEFAULT 'PRIMARY';

-- AlterTable
ALTER TABLE "FilterOption" ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 0;
