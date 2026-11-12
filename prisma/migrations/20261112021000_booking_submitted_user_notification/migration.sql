-- User-facing acknowledgement of a newly submitted booking request.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_SUBMITTED';
