-- Preserve an immutable audit trail when a confirmed visit is corrected.
ALTER TYPE "UserEventType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_CORRECTED';
