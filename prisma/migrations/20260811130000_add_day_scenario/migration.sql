-- CreateTable
CREATE TABLE "DayScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "planFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayScenario_userId_date_key" ON "DayScenario"("userId", "date");

-- CreateIndex
CREATE INDEX "DayScenario_userId_idx" ON "DayScenario"("userId");

-- AddForeignKey
ALTER TABLE "DayScenario" ADD CONSTRAINT "DayScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
