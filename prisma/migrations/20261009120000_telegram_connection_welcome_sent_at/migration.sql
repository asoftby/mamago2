-- Bot welcome message: sent at most once per connection (compare-and-set on NULL).
-- Nullable column, no backfill; existing connections get the welcome on their next /start.
ALTER TABLE "TelegramConnection" ADD COLUMN "welcomeSentAt" TIMESTAMP(3);
