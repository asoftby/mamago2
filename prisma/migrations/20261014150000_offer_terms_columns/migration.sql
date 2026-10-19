-- Additive: payment/cancellation terms and service area for every offer type (new wizard, step "Условия и контакты").
-- No backfill: party offers keep their terms in Offer.details; the wizard copies them into these columns on first save.
ALTER TABLE "Offer"
  ADD COLUMN "prepaymentTerms" TEXT,
  ADD COLUMN "cancellationTerms" TEXT,
  ADD COLUMN "serviceAreaText" TEXT;
