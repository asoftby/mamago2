-- Additive, non-blocking onboarding state, scoped to an active business member.
CREATE TABLE "BusinessOnboardingState" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "tourCompletedAt" TIMESTAMP(3),
    "tourSkippedAt" TIMESTAMP(3),
    "firstPublicViewedAt" TIMESTAMP(3),
    "tourVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessOnboardingState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessOnboardingState_businessId_userId_key"
    ON "BusinessOnboardingState"("businessId", "userId");
CREATE INDEX "BusinessOnboardingState_userId_idx"
    ON "BusinessOnboardingState"("userId");

ALTER TABLE "BusinessOnboardingState"
    ADD CONSTRAINT "BusinessOnboardingState_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessOnboardingState"
    ADD CONSTRAINT "BusinessOnboardingState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
