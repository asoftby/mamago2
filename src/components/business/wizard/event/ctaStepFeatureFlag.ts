export type EventPricingCtaRenderMode = "legacy" | "shared";

const EVENT_CTA_STEP_FLAG_ENV = "NEXT_PUBLIC_ENABLE_EVENT_CTA_STEP";

type EventCtaStepFeatureEnv = {
  NODE_ENV?: string;
  [EVENT_CTA_STEP_FLAG_ENV]?: string | undefined;
};

function parseExplicitOverride(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function isEventCtaStepFeatureEnabled(
  env: EventCtaStepFeatureEnv = process.env,
): boolean {
  const explicitOverride = parseExplicitOverride(env[EVENT_CTA_STEP_FLAG_ENV]);
  if (explicitOverride !== null) {
    return explicitOverride;
  }

  return false;
}

export function resolveEventPricingParticipationCtaRenderMode(
  enabled = isEventCtaStepFeatureEnabled(),
): EventPricingCtaRenderMode {
  return enabled ? "shared" : "legacy";
}
