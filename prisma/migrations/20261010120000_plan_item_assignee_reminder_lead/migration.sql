-- My Plan: assignee (adult family member) and per-item reminder lead time for manual plan items
ALTER TABLE "PlanItem" ADD COLUMN "reminderLeadMinutes" INTEGER;
ALTER TABLE "PlanItem" ADD COLUMN "assigneeUserId" TEXT;

-- CreateIndex
CREATE INDEX "PlanItem_assigneeUserId_idx" ON "PlanItem"("assigneeUserId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
