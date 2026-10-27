-- Optional visit allowance for a group tariff; existing tariff rows remain valid.
ALTER TABLE "OfferClassTariff" ADD COLUMN "visitsCount" INTEGER;
