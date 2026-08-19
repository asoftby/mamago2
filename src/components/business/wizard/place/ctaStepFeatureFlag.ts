export type PlaceCtaRenderMode = "legacy" | "shared";

const PLACE_CTA_STEP_FLAG_ENV = "NEXT_PUBLIC_ENABLE_PLACE_CTA_STEP";

type PlaceCtaStepFeatureEnv = {
  NODE_ENV?: string;
  [PLACE_CTA_STEP_FLAG_ENV]?: string | undefined;
};

function parseExplicitOverride(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function isPlaceCtaStepFeatureEnabled(
  env: PlaceCtaStepFeatureEnv = process.env,
): boolean {
  const explicitOverride = parseExplicitOverride(env[PLACE_CTA_STEP_FLAG_ENV]);
  if (explicitOverride !== null) {
    return explicitOverride;
  }

  return false;
}

export function resolvePlaceCtaRenderMode(
  enabled = isPlaceCtaStepFeatureEnabled(),
): PlaceCtaRenderMode {
  return enabled ? "shared" : "legacy";
}
