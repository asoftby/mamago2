-- CreateTable
CREATE TABLE "MetroStation" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "osmType" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'OSM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetroStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cityId" TEXT,
    "metroStationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetroStation_cityId_idx" ON "MetroStation"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "MetroStation_cityId_osmType_osmId_key" ON "MetroStation"("cityId", "osmType", "osmId");

-- CreateIndex
CREATE UNIQUE INDEX "MetroStation_cityId_name_key" ON "MetroStation"("cityId", "name");

-- AddForeignKey
ALTER TABLE "MetroStation" ADD CONSTRAINT "MetroStation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_metroStationId_fkey" FOREIGN KEY ("metroStationId") REFERENCES "MetroStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
