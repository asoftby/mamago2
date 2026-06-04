-- CreateTable
CREATE TABLE "SearchQueryLog" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL,
    "clickedEntityId" TEXT,
    "clickedEntityType" TEXT,
    "cityId" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchQueryLog_query_idx" ON "SearchQueryLog"("query");

-- CreateIndex
CREATE INDEX "SearchQueryLog_resultsCount_idx" ON "SearchQueryLog"("resultsCount");

-- CreateIndex
CREATE INDEX "SearchQueryLog_cityId_idx" ON "SearchQueryLog"("cityId");

-- CreateIndex
CREATE INDEX "SearchQueryLog_userId_idx" ON "SearchQueryLog"("userId");

-- CreateIndex
CREATE INDEX "SearchQueryLog_createdAt_idx" ON "SearchQueryLog"("createdAt");

-- CreateIndex
CREATE INDEX "SearchQueryLog_query_resultsCount_idx" ON "SearchQueryLog"("query", "resultsCount");

-- AddForeignKey
ALTER TABLE "SearchQueryLog" ADD CONSTRAINT "SearchQueryLog_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQueryLog" ADD CONSTRAINT "SearchQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
