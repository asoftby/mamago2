-- Family Core M4a: plan visibility domain events + PlanItem.updatedAt (edit-conflict detection).
-- Additive only. New enum values are server-only event types.
-- Rollback: ALTER TABLE "PlanItem" DROP COLUMN "updatedAt" (enum values cannot be dropped; they are unused when the code is reverted).

ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'PLAN_ITEM_SHARED';
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'PLAN_ITEM_MADE_PRIVATE';
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'PLAN_ITEM_RESCHEDULED';

-- Constant-time metadata change on PostgreSQL 11+ (non-volatile default); existing rows get the migration time.
ALTER TABLE "PlanItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
