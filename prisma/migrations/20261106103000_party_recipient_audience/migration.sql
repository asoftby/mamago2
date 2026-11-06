ALTER TABLE "PartyOrder" ADD COLUMN "recipientAudience" TEXT;
ALTER TABLE "PartyOrder" ADD CONSTRAINT "PartyOrder_recipientAudience_check"
  CHECK ("recipientAudience" IN ('ADULT', 'CHILD'));
