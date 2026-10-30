-- Daily admin digest for Telegram channel import. Additive enum value only.
-- Written by hand: `prisma migrate dev` is not used in this repo (see CLAUDE.md).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'IMPORT_CHANNELS_DIGEST';
