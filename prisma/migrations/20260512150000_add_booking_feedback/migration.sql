-- CreateTable: BookingFeedback
-- One feedback per booking (UNIQUE on bookingId).
-- Only for COMPLETED bookings — enforced at application layer.

CREATE TABLE IF NOT EXISTS "BookingFeedback" (
  "id"        TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "userId"    TEXT,
  "rating"    INTEGER NOT NULL,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingFeedback_bookingId_key" UNIQUE ("bookingId"),
  CONSTRAINT "BookingFeedback_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

-- AddForeignKey: BookingFeedback → BookingRequest
ALTER TABLE "BookingFeedback"
  ADD CONSTRAINT "BookingFeedback_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BookingFeedback → User (nullable)
ALTER TABLE "BookingFeedback"
  ADD CONSTRAINT "BookingFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "BookingFeedback_bookingId_idx"
  ON "BookingFeedback"("bookingId");

CREATE INDEX IF NOT EXISTS "BookingFeedback_userId_idx"
  ON "BookingFeedback"("userId");

CREATE INDEX IF NOT EXISTS "BookingFeedback_createdAt_idx"
  ON "BookingFeedback"("createdAt");
