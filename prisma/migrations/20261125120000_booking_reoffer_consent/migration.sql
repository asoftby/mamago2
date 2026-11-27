-- Client-approved reoffer. The old rejected booking is never reopened.
CREATE TYPE "BookingReofferStatus" AS ENUM ('OFFERED','ACCEPTED','DECLINED','CANCELED','EXPIRED');

CREATE TABLE "BookingReoffer" (
  "id" TEXT NOT NULL,
  "originalBookingId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "customerUserId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "status" "BookingReofferStatus" NOT NULL DEFAULT 'OFFERED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "invitedById" TEXT NOT NULL,
  "newBookingId" TEXT,
  CONSTRAINT "BookingReoffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingReoffer_originalBookingId_key" ON "BookingReoffer"("originalBookingId");
CREATE UNIQUE INDEX "BookingReoffer_newBookingId_key" ON "BookingReoffer"("newBookingId");
CREATE INDEX "BookingReoffer_customerUserId_status_expiresAt_idx" ON "BookingReoffer"("customerUserId","status","expiresAt");
CREATE INDEX "BookingReoffer_businessId_status_createdAt_idx" ON "BookingReoffer"("businessId","status","createdAt");
ALTER TABLE "BookingReoffer" ADD CONSTRAINT "BookingReoffer_originalBookingId_fkey" FOREIGN KEY ("originalBookingId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingReoffer" ADD CONSTRAINT "BookingReoffer_newBookingId_fkey" FOREIGN KEY ("newBookingId") REFERENCES "BookingRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
