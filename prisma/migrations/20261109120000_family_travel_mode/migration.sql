-- Additive (BACKLOG-230, PR 3b-3): the family's preferred way of getting around for the day scenario
-- ('walk' or 'car'; NULL = never chosen, read as 'car'). No backfill, no index, nothing else is touched.
ALTER TABLE "Family" ADD COLUMN "travelMode" TEXT;
