-- CreateTable
CREATE TABLE "UserBehaviorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalOpens" INTEGER NOT NULL DEFAULT 0,
    "totalSaves" INTEGER NOT NULL DEFAULT 0,
    "totalPlanAdds" INTEGER NOT NULL DEFAULT 0,
    "totalCtaClicks" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "weekendShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sameDayPlanningShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePlanningShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preferredFormats" JSONB,
    "preferredCategories" JSONB,
    "preferredSignals" JSONB,
    "preferredVerticals" JSONB,
    "segments" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBehaviorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBehaviorProfile_userId_key" ON "UserBehaviorProfile"("userId");

-- CreateIndex
CREATE INDEX "UserBehaviorProfile_userId_idx" ON "UserBehaviorProfile"("userId");

-- CreateIndex
CREATE INDEX "UserBehaviorProfile_lastSeenAt_idx" ON "UserBehaviorProfile"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "UserBehaviorProfile" ADD CONSTRAINT "UserBehaviorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
