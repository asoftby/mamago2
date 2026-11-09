-- Additive (BACKLOG-230, PR 3c-2): the dates a guest has already built a day scenario for, so only the FIRST build of a
-- date counts against the guest quota (GuestUsage.generationsCount). Empty for every existing row; nothing else changes.
ALTER TABLE "GuestUsage" ADD COLUMN "scenarioDates" TEXT[] DEFAULT ARRAY[]::TEXT[];
