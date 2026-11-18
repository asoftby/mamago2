-- Direct complaints: notify moderators about a new complaint and the reporter about the outcome.
-- Additive enum values only; no data changes.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DIRECT_COMPLAINT_OPENED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DIRECT_COMPLAINT_RESOLVED';
