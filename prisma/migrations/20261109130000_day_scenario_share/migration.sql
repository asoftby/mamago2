-- Additive (BACKLOG-230, PR 3c-1): a revocable capability link to a saved «День от mamaGo» (one day or its weekend
-- group). A new table only; nothing existing is touched.
CREATE TABLE "DayScenarioShare" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DayScenarioShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DayScenarioShare_token_key" ON "DayScenarioShare"("token");
CREATE INDEX "DayScenarioShare_userId_date_idx" ON "DayScenarioShare"("userId", "date");

ALTER TABLE "DayScenarioShare" ADD CONSTRAINT "DayScenarioShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
