-- CreateTable
CREATE TABLE "ActivityFilterOption" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "filterOptionId" TEXT NOT NULL,

    CONSTRAINT "ActivityFilterOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityFilterOption_filterOptionId_idx" ON "ActivityFilterOption"("filterOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityFilterOption_activityId_filterOptionId_key" ON "ActivityFilterOption"("activityId", "filterOptionId");

-- AddForeignKey
ALTER TABLE "ActivityFilterOption" ADD CONSTRAINT "ActivityFilterOption_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFilterOption" ADD CONSTRAINT "ActivityFilterOption_filterOptionId_fkey" FOREIGN KEY ("filterOptionId") REFERENCES "FilterOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
