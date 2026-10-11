-- Party constructor — PR 1A: additive values on existing enums.
-- Schema-only. Kept in its own migration so that later migrations and code can
-- use these values only after this one is committed (PostgreSQL restriction on
-- ALTER TYPE ... ADD VALUE). IF NOT EXISTS keeps the migration re-runnable.
-- See docs/engineering/party-mvp-spec.md §2.2.

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CHANGES_PROPOSED';

-- AlterEnum
ALTER TYPE "BookingActivityActorType" ADD VALUE IF NOT EXISTS 'CUSTOMER';
ALTER TYPE "BookingActivityActorType" ADD VALUE IF NOT EXISTS 'MAMAGO';

-- AlterEnum
ALTER TYPE "BookingActivityType" ADD VALUE IF NOT EXISTS 'TERMS_PROPOSED';
ALTER TYPE "BookingActivityType" ADD VALUE IF NOT EXISTS 'TERMS_ACCEPTED';
ALTER TYPE "BookingActivityType" ADD VALUE IF NOT EXISTS 'UNIT_ASSIGNED';
ALTER TYPE "BookingActivityType" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "BookingActivityType" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "BookingActivityType" ADD VALUE IF NOT EXISTS 'REPLACED';

-- AlterEnum
ALTER TYPE "BillingActionType" ADD VALUE IF NOT EXISTS 'PARTY_BOOKING_CONFIRMED';

-- AlterEnum
ALTER TYPE "BillingTransactionType" ADD VALUE IF NOT EXISTS 'COMMISSION_REVERSAL';
ALTER TYPE "BillingTransactionType" ADD VALUE IF NOT EXISTS 'PENALTY_CHARGE';

-- AlterEnum
ALTER TYPE "BillingReferenceType" ADD VALUE IF NOT EXISTS 'PARTY_COMMISSION';
ALTER TYPE "BillingReferenceType" ADD VALUE IF NOT EXISTS 'VENDOR_PENALTY';
