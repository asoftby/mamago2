-- Additive: per-business feature flags (newOfferWizard, leadForm, selections). Missing key = disabled.
ALTER TABLE "Business" ADD COLUMN "features" JSONB NOT NULL DEFAULT '{}';
