CREATE TYPE "PackageComponentRemovalPolicy" AS ENUM (
  'REQUIRED', 'REMOVABLE_NO_REFUND', 'REMOVABLE_FIXED_CREDIT', 'REMOVABLE_QUOTE_REQUIRED'
);

ALTER TABLE "PackageComponent"
  ADD COLUMN "removalPolicy" "PackageComponentRemovalPolicy",
  ADD COLUMN "removalCreditByn" DECIMAL(10, 2),
  ADD CONSTRAINT "PackageComponent_removal_credit_check" CHECK (
    CASE WHEN "removalPolicy" = 'REMOVABLE_FIXED_CREDIT'
      THEN "removalCreditByn" IS NOT NULL AND "removalCreditByn" > 0
      ELSE "removalCreditByn" IS NULL
    END
  );
