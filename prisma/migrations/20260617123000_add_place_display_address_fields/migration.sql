ALTER TABLE "Place"
ADD COLUMN "displayAddress" TEXT,
ADD COLUMN "locationName" TEXT,
ADD COLUMN "directionsNote" TEXT;

ALTER TABLE "PlaceRevision"
ADD COLUMN "displayAddress" TEXT,
ADD COLUMN "locationName" TEXT,
ADD COLUMN "directionsNote" TEXT;
