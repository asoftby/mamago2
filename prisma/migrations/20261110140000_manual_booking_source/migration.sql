CREATE TYPE "BookingSource" AS ENUM ('MANUAL');

ALTER TABLE "BookingRequest"
ADD COLUMN "source" "BookingSource",
ADD COLUMN "manualRequestKey" TEXT,
ADD COLUMN "manualRequestHash" TEXT;

CREATE UNIQUE INDEX "BookingRequest_businessId_manualRequestKey_key"
ON "BookingRequest"("businessId", "manualRequestKey");
