-- Business contact SMS OTP escalation (wrong-attempt locks, support gate)
ALTER TABLE "User" ADD COLUMN "businessContactOtpFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "businessContactOtpLockTier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "businessContactOtpLockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "businessContactOtpSupportRequired" BOOLEAN NOT NULL DEFAULT false;
