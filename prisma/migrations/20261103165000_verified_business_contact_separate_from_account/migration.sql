-- Keep personal account phone unchanged when verifying a business contact.
ALTER TABLE "User"
  ADD COLUMN "businessContactVerifiedPhoneE164" TEXT,
  ADD COLUMN "businessContactPhoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_businessContactVerifiedPhoneE164_key"
  ON "User"("businessContactVerifiedPhoneE164");
