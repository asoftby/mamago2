-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RouteVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "BudgetLevel" AS ENUM ('FREE', 'LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoH1" TEXT,
ADD COLUMN     "seoJsonLdOverride" JSONB,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgImage" TEXT,
ADD COLUMN     "seoOgTitle" TEXT,
ADD COLUMN     "seoRobots" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "slugUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActivitySlugHistory" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitySlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ageTags" TEXT[],
    "budgetLevel" "BudgetLevel" NOT NULL DEFAULT 'LOW',
    "cityId" TEXT,
    "coverImageUrl" TEXT,
    "authorId" TEXT,
    "status" "RouteStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "RouteVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "placeId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "address" TEXT,
    "customTitle" TEXT,
    "note" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivitySlugHistory_slug_key" ON "ActivitySlugHistory"("slug");

-- CreateIndex
CREATE INDEX "ActivitySlugHistory_activityId_idx" ON "ActivitySlugHistory"("activityId");

-- CreateIndex
CREATE INDEX "ActivitySlugHistory_slug_idx" ON "ActivitySlugHistory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Route_slug_key" ON "Route"("slug");

-- CreateIndex
CREATE INDEX "Route_status_visibility_idx" ON "Route"("status", "visibility");

-- CreateIndex
CREATE INDEX "Route_authorId_idx" ON "Route"("authorId");

-- CreateIndex
CREATE INDEX "Route_cityId_idx" ON "Route"("cityId");

-- CreateIndex
CREATE INDEX "Route_slug_idx" ON "Route"("slug");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_order_idx" ON "RouteStop"("routeId", "order");

-- CreateIndex
CREATE INDEX "RouteStop_placeId_idx" ON "RouteStop"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_slug_key" ON "Activity"("slug");

-- CreateIndex
CREATE INDEX "Activity_slug_idx" ON "Activity"("slug");

-- AddForeignKey
ALTER TABLE "ActivitySlugHistory" ADD CONSTRAINT "ActivitySlugHistory_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

