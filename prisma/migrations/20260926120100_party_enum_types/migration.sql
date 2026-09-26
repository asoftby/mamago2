-- Party constructor — PR 1B: new enum types. No tables, no columns.
-- Models that use these types arrive in PR 2.
-- See docs/engineering/party-mvp-spec.md §2.1.

-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartySlotStatus" AS ENUM ('PLANNED', 'REQUESTED', 'CONFIRMED', 'REPLACING', 'UNFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartySlotFillMode" AS ENUM ('EMPTY', 'OFFER', 'OWN');

-- CreateEnum
CREATE TYPE "CapacityMode" AS ENUM ('EXCLUSIVE', 'MULTI');

-- CreateEnum
CREATE TYPE "PrepaymentType" AS ENUM ('NONE', 'PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "PartyPricingUnit" AS ENUM ('PER_EVENT', 'PER_HOUR', 'PER_CHILD');

-- CreateEnum
CREATE TYPE "TermsSnapshotStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PriceLineType" AS ENUM ('BASE', 'EXTRA_CHILD', 'EXTRA_HOUR', 'OFF_SITE', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingUnitStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartyBillingMode" AS ENUM ('SHADOW', 'LIVE');

-- CreateEnum
CREATE TYPE "PartyCommissionStatus" AS ENUM ('ACCRUED', 'REVERSED');

-- CreateEnum
CREATE TYPE "VendorPenaltyStatus" AS ENUM ('ACCRUED', 'WAIVED', 'REVERSED');
