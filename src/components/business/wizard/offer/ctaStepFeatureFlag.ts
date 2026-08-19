export type OfferPricingCtaRenderMode = "legacy" | "shared";

const OFFER_CTA_STEP_FLAG_ENV = "NEXT_PUBLIC_ENABLE_OFFER_CTA_STEP";

type OfferCtaStepFeatureEnv = {
  NODE_ENV?: string;
  [OFFER_CTA_STEP_FLAG_ENV]?: string | undefined;
};

function parseExplicitOverride(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function isOfferCtaStepFeatureEnabled(
  env: OfferCtaStepFeatureEnv = process.env,
): boolean {
  const explicitOverride = parseExplicitOverride(env[OFFER_CTA_STEP_FLAG_ENV]);
  if (explicitOverride !== null) {
    return explicitOverride;
  }

  return env.NODE_ENV !== "production";
}

export function resolveOfferPricingCtaRenderMode(
  enabled = isOfferCtaStepFeatureEnabled(),
): OfferPricingCtaRenderMode {
  return enabled ? "shared" : "legacy";
}
