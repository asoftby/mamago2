-- Dedicated, opt-in notification for an editorial correction request on a published place.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PLACE_IMPROVEMENT_REQUESTED';
