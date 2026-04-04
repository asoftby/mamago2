-- AlterTable
ALTER TABLE "EventCategory" ADD COLUMN     "selectableInProgram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsProgram" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ActivityProgramCategory" (
    "activityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityProgramCategory_pkey" PRIMARY KEY ("activityId","categoryId")
);

-- CreateIndex
CREATE INDEX "ActivityProgramCategory_categoryId_idx" ON "ActivityProgramCategory"("categoryId");

-- AddForeignKey
ALTER TABLE "ActivityProgramCategory" ADD CONSTRAINT "ActivityProgramCategory_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProgramCategory" ADD CONSTRAINT "ActivityProgramCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
