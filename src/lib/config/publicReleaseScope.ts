export type PublicReleaseEnvironment = {
  APP_ENV?: string;
};

export type DeferredPublicFeature =
  | "classes"
  | "birthday"
  | "birthdayBuilder"
  | "camps";

const FULL_SCOPE_ENVIRONMENTS = new Set([
  "dev",
  "development",
  "local",
  "staging",
  "preview",
  "test",
]);

export function hasFullPublicReleaseScope(
  env: PublicReleaseEnvironment = { APP_ENV: process.env.APP_ENV },
): boolean {
  const appEnv = env.APP_ENV?.trim().toLowerCase() ?? "";
  return FULL_SCOPE_ENVIRONMENTS.has(appEnv);
}

export function isDeferredPublicFeatureEnabled(
  feature: DeferredPublicFeature,
  env: PublicReleaseEnvironment = { APP_ENV: process.env.APP_ENV },
): boolean {
  void feature;
  return hasFullPublicReleaseScope(env);
}

export function isOfferTypeInPublicReleaseScope(
  productType: string | null | undefined,
  env: PublicReleaseEnvironment = { APP_ENV: process.env.APP_ENV },
): boolean {
  if (hasFullPublicReleaseScope(env)) return true;
  return productType === "PLACE_VISIT";
}

const DEFERRED_PUBLIC_SECTIONS = new Set([
  "classes",
  "programs",
  "birthday",
]);

export function isDeferredPublicPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 2) return false;

  const [city, section] = segments;

  if (
    ["admin", "business", "me", "api", "editor", "_next"].includes(city)
  ) {
    return false;
  }

  return DEFERRED_PUBLIC_SECTIONS.has(section);
}

export function isPublicPathBlockedByReleaseScope(
  pathname: string,
  env: PublicReleaseEnvironment = { APP_ENV: process.env.APP_ENV },
): boolean {
  return !hasFullPublicReleaseScope(env) &&
    isDeferredPublicPath(pathname);
}
