-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN     "planRouteSlug" TEXT;

-- CreateIndex
CREATE INDEX "PlanItem_userId_planRouteSlug_idx" ON "PlanItem"("userId", "planRouteSlug");
