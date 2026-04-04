-- CreateEnum
CREATE TYPE "UserEventType" AS ENUM ('PAGE_VIEW', 'CARD_VIEW', 'DETAIL_OPEN', 'SAVE', 'UNSAVE', 'PLAN_ADD', 'PLAN_REMOVE', 'CTA_CLICK', 'SEARCH_APPLY', 'FILTER_APPLY');

-- CreateEnum
CREATE TYPE "AnalyticsEntityType" AS ENUM ('EVENT', 'PLACE', 'OFFER', 'ROUTE', 'ARTICLE');

-- CreateEnum
CREATE TYPE "AnalyticsVertical" AS ENUM ('CITY', 'TRAVEL', 'BIRTHDAY', 'EDUCATION', 'WEEKEND', 'SEASONAL');

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "eventType" "UserEventType" NOT NULL,
    "entityType" "AnalyticsEntityType",
    "entityId" TEXT,
    "vertical" "AnalyticsVertical",
    "cityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEvent_userId_createdAt_idx" ON "UserEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_sessionId_createdAt_idx" ON "UserEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_eventType_createdAt_idx" ON "UserEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_entityType_entityId_createdAt_idx" ON "UserEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_vertical_createdAt_idx" ON "UserEvent"("vertical", "createdAt");

-- CreateIndex
CREATE INDEX "UserEvent_cityId_createdAt_idx" ON "UserEvent"("cityId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
