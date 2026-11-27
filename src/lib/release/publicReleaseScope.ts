/**
 * Public release scope (AUDIT-XR-19).
 *
 * The first public PROD release excludes «Занятия» (classes/programs),
 * «Праздники» and the birthday constructor, and has no standalone public
 * place catalogue. Code and data stay in place for later releases: this module
 * only decides what the *public* surface exposes. It is pure and edge/proxy
 * safe (no Prisma, no Node-only imports).
 *
 * Each excluded feature is OFF unless explicitly enabled with an env flag set
 * to "true". Place records keep serving allowed scenarios (event venues,
 * articles, search, B2B); only the catalogue promotion (sitemap) is withheld.
 */

export type PublicReleaseFeature = "classes" | "birthday" | "placesCatalog";

const FEATURE_ENV_KEYS = {
  classes: "ENABLE_PUBLIC_CLASSES",
  birthday: "ENABLE_PUBLIC_BIRTHDAY",
  placesCatalog: "ENABLE_PUBLIC_PLACES_CATALOG",
} as const satisfies Record<PublicReleaseFeature, string>;

type Env = Record<string, string | undefined>;

export function isPublicReleaseFeatureEnabled(feature: PublicReleaseFeature, env: Env = process.env): boolean {
  return env[FEATURE_ENV_KEYS[feature]]?.trim().toLowerCase() === "true";
}

/**
 * First path segments that are never a city slug. A `/{segment}/classes`
 * path under one of these is someone else's route (for example an article
 * slug) and must not be gated.
 */
const NON_CITY_SEGMENTS = new Set([
  "admin", "api", "auth", "blog", "business", "d", "editor", "ideas", "invite",
  "legal", "login", "me", "notifications", "offers", "p", "page", "places",
  "preview", "profile", "profile-entry", "register", "routes", "search", "ui-lab",
  "ui-test", "w",
]);

const CITY_SECTION_FEATURE: Record<string, PublicReleaseFeature> = {
  classes: "classes",
  programs: "classes",
  birthday: "birthday",
};

/** Page paths (proxy-level) that belong to a disabled public feature. */
export function disabledFeatureForPagePath(pathname: string, env: Env = process.env): PublicReleaseFeature | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "me" && segments[1] === "birthdays") {
    return isPublicReleaseFeatureEnabled("birthday", env) ? null : "birthday";
  }
  if (segments.length >= 2 && !NON_CITY_SEGMENTS.has(segments[0])) {
    const feature = CITY_SECTION_FEATURE[segments[1]];
    if (feature && !isPublicReleaseFeatureEnabled(feature, env)) return feature;
  }
  return null;
}

/** Minimal, real 404 for gated pages (independent of streaming boundaries). */
export function releaseScopeNotFoundHtml(): string {
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Страница не найдена — mamaGo</title></head><body><main style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem"><h1>Страница не найдена</h1><p>Этот раздел пока недоступен.</p><p><a href="/">На главную</a></p></main></body></html>';
}

export type PublicReleaseOffer = {
  productType?: string | null;
  campProgramType?: string | null;
};

const OFFER_PRODUCT_FEATURE: Record<string, PublicReleaseFeature> = {
  ONE_TIME_ACTIVITY: "classes",
  REGULAR_ACTIVITY: "classes",
  PARTY_SERVICE: "birthday",
  PARTY_PACKAGE: "birthday",
};

/**
 * Which excluded feature an offer belongs to, by its product type. Camps,
 * place visits and legacy offers without a product type stay public.
 * `Offer.kind` is deliberately ignored: every service offer is `SERVICE`.
 */
export function offerReleaseFeature(offer: PublicReleaseOffer): PublicReleaseFeature | null {
  if (offer.campProgramType) return null;
  return (offer.productType && OFFER_PRODUCT_FEATURE[offer.productType]) || null;
}

export function isOfferPublicInRelease(offer: PublicReleaseOffer, env: Env = process.env): boolean {
  const feature = offerReleaseFeature(offer);
  return !feature || isPublicReleaseFeatureEnabled(feature, env);
}
