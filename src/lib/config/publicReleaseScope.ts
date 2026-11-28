export type PublicReleaseEnvironment = {
  APP_ENV?: string;
  ENABLE_PUBLIC_CLASSES?: string;
  ENABLE_PUBLIC_BIRTHDAY?: string;
  ENABLE_PUBLIC_PLACES_CATALOG?: string;
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
  env: PublicReleaseEnvironment = process.env,
): boolean {
  const appEnv = env.APP_ENV?.trim().toLowerCase() ?? "";
  return FULL_SCOPE_ENVIRONMENTS.has(appEnv);
}

export function isDeferredPublicFeatureEnabled(
  feature: DeferredPublicFeature,
  env: PublicReleaseEnvironment = { APP_ENV: process.env.APP_ENV },
): boolean {
  if (hasFullPublicReleaseScope(env)) return true;
  const flag = feature === "birthday" || feature === "birthdayBuilder"
    ? env.ENABLE_PUBLIC_BIRTHDAY
    : env.ENABLE_PUBLIC_CLASSES;
  return flag?.trim().toLowerCase() === "true";
}

export function isOfferTypeInPublicReleaseScope(
  productType: string | null | undefined,
  env: PublicReleaseEnvironment = { APP_ENV: process.env.APP_ENV },
): boolean {
  if (hasFullPublicReleaseScope(env)) return true;
  if (productType === "PLACE_VISIT") return true;
  if (productType === "PARTY_SERVICE" || productType === "PARTY_PACKAGE") {
    return isDeferredPublicFeatureEnabled("birthday", env);
  }
  if (productType === "ONE_TIME_ACTIVITY" || productType === "REGULAR_ACTIVITY" || productType === "CAMP") {
    return isDeferredPublicFeatureEnabled("classes", env);
  }
  return false;
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
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || !isDeferredPublicPath(pathname)) return false;
  const feature = segments[1] === "birthday" ? "birthday" : "classes";
  return !isDeferredPublicFeatureEnabled(feature, env);
}
