-- CreateEnum: BookingActivityType
CREATE TYPE "BookingActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'PHONE_CLICKED', 'COMMENT_ADDED');

-- CreateEnum: BookingActivityActorType
CREATE TYPE "BookingActivityActorType" AS ENUM ('BUSINESS', 'SYSTEM');

-- AlterTable: add lastActivityAt to BookingRequest
ALTER TABLE "BookingRequest"
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- CreateTable: BookingActivity
CREATE TABLE IF NOT EXISTS "BookingActivity" (
  "id"         TEXT NOT NULL,
  "bookingId"  TEXT NOT NULL,
  "type"       "BookingActivityType" NOT NULL,
  "actorType"  "BookingActivityActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorId"    TEXT,
  "payload"    JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BookingActivity_bookingId_createdAt_idx"
  ON "BookingActivity"("bookingId", "createdAt");

CREATE INDEX IF NOT EXISTS "BookingActivity_bookingId_type_idx"
  ON "BookingActivity"("bookingId", "type");

-- AddForeignKey
ALTER TABLE "BookingActivity"
  ADD CONSTRAINT "BookingActivity_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
