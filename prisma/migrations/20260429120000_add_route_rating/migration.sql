-- CreateTable "RouteRating"
CREATE TABLE "RouteRating" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "ratingType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteRating_routeId_identifier_key" ON "RouteRating"("routeId", "identifier");

-- CreateIndex
CREATE INDEX "RouteRating_routeId_idx" ON "RouteRating"("routeId");

-- CreateIndex
CREATE INDEX "RouteRating_routeId_ratingType_idx" ON "RouteRating"("routeId", "ratingType");

-- CreateIndex
CREATE INDEX "RouteRating_identifier_idx" ON "RouteRating"("identifier");

-- CreateIndex
CREATE INDEX "RouteRating_userId_idx" ON "RouteRating"("userId");

-- AddForeignKey
ALTER TABLE "RouteRating" ADD CONSTRAINT "RouteRating_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteRating" ADD CONSTRAINT "RouteRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
