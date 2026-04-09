-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN     "routeId" TEXT;

-- CreateTable
CREATE TABLE "RouteIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RouteIdea_userId_idx" ON "RouteIdea"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteIdea_userId_routeId_key" ON "RouteIdea"("userId", "routeId");

-- CreateIndex
CREATE INDEX "PlanItem_routeId_idx" ON "PlanItem"("routeId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteIdea" ADD CONSTRAINT "RouteIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteIdea" ADD CONSTRAINT "RouteIdea_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
