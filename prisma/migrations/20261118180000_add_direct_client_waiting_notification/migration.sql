-- Direct: throttled "client is waiting for a reply" notice for business e-mail/Telegram.
-- Additive enum value only; no data changes.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DIRECT_CLIENT_WAITING';
