-- CreateTable
CREATE TABLE "DayScenarioItemOverride" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "startTimeOverride" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayScenarioItemOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayScenarioItemOverride_scenarioId_planItemId_key" ON "DayScenarioItemOverride"("scenarioId", "planItemId");

-- CreateIndex
CREATE INDEX "DayScenarioItemOverride_scenarioId_idx" ON "DayScenarioItemOverride"("scenarioId");

-- CreateIndex
CREATE INDEX "DayScenarioItemOverride_planItemId_idx" ON "DayScenarioItemOverride"("planItemId");

-- AddForeignKey
ALTER TABLE "DayScenarioItemOverride" ADD CONSTRAINT "DayScenarioItemOverride_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DayScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayScenarioItemOverride" ADD CONSTRAINT "DayScenarioItemOverride_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
