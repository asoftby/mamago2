export type MigrationEnvironment = "LOCAL" | "DEV" | "PROD";
export type MigrationProfileName = "FULL_IMPORT" | "DEV_VALIDATION" | "PRODUCTION" | "PROD_IMPORT";

export type MediaPolicyName = "FULL" | "METADATA" | "NONE";
export type SeoPolicyName = "DRY_RUN" | "VALIDATE" | "PRODUCTION";
export type RedirectPolicyName = "VALIDATE" | "APPLY";

export interface MediaPolicy {
  name: MediaPolicyName;
  allowDownload: boolean;
  allowUpload: boolean;
  allowRemoteFetch: boolean;
  linkActivityMedia: boolean;
}

export interface SeoPolicy {
  name: SeoPolicyName;
  validateCanonical: boolean;
  validateSitemap: boolean;
  requireIndexingEnabled: boolean;
}

export interface RedirectPolicy {
  name: RedirectPolicyName;
  validateManifest: boolean;
  applyRedirects: boolean;
}

export interface MigrationProfile {
  name: MigrationProfileName;
  environment: MigrationEnvironment;
  mediaPolicy: MediaPolicy;
  seoPolicy: SeoPolicy;
  redirectPolicy: RedirectPolicy;
  validateOnly: boolean;
}

export const MEDIA_POLICIES: Record<MediaPolicyName, MediaPolicy> = {
  FULL: {
    name: "FULL",
    allowDownload: true,
    allowUpload: true,
    allowRemoteFetch: true,
    linkActivityMedia: true,
  },
  METADATA: {
    name: "METADATA",
    allowDownload: false,
    allowUpload: false,
    allowRemoteFetch: false,
    linkActivityMedia: false,
  },
  NONE: {
    name: "NONE",
    allowDownload: false,
    allowUpload: false,
    allowRemoteFetch: false,
    linkActivityMedia: false,
  },
};

export const SEO_POLICIES: Record<SeoPolicyName, SeoPolicy> = {
  DRY_RUN: {
    name: "DRY_RUN",
    validateCanonical: false,
    validateSitemap: false,
    requireIndexingEnabled: false,
  },
  VALIDATE: {
    name: "VALIDATE",
    validateCanonical: true,
    validateSitemap: true,
    requireIndexingEnabled: false,
  },
  PRODUCTION: {
    name: "PRODUCTION",
    validateCanonical: true,
    validateSitemap: true,
    requireIndexingEnabled: true,
  },
};

export const REDIRECT_POLICIES: Record<RedirectPolicyName, RedirectPolicy> = {
  VALIDATE: {
    name: "VALIDATE",
    validateManifest: true,
    applyRedirects: false,
  },
  APPLY: {
    name: "APPLY",
    validateManifest: true,
    applyRedirects: true,
  },
};

const PROFILE_DEFAULTS: Record<
  MigrationProfileName,
  {
    environment: MigrationEnvironment;
    mediaPolicy: MediaPolicyName;
    seoPolicy: SeoPolicyName;
    redirectPolicy: RedirectPolicyName;
    validateOnly: boolean;
  }
> = {
  FULL_IMPORT: {
    environment: "LOCAL",
    mediaPolicy: "FULL",
    seoPolicy: "DRY_RUN",
    redirectPolicy: "VALIDATE",
    validateOnly: false,
  },
  DEV_VALIDATION: {
    environment: "DEV",
    mediaPolicy: "METADATA",
    seoPolicy: "VALIDATE",
    redirectPolicy: "VALIDATE",
    validateOnly: false,
  },
  PRODUCTION: {
    environment: "PROD",
    mediaPolicy: "FULL",
    seoPolicy: "PRODUCTION",
    redirectPolicy: "APPLY",
    validateOnly: false,
  },
  /**
   * Pre-cutover PROD content+media import. FULL media, no search-engine
   * indexing requirement, redirects stay VALIDATE (not APPLY). Use this
   * (or `--profile FULL_IMPORT --media-policy FULL`) while prod.mamago.by
   * must remain noindex. PRODUCTION remains the cutover profile.
   */
  PROD_IMPORT: {
    environment: "PROD",
    mediaPolicy: "FULL",
    seoPolicy: "VALIDATE",
    redirectPolicy: "VALIDATE",
    validateOnly: false,
  },
};

export interface ResolveMigrationProfileInput {
  env?: NodeJS.ProcessEnv;
  profileName?: MigrationProfileName;
  mediaPolicyName?: MediaPolicyName;
  seoPolicyName?: SeoPolicyName;
  redirectPolicyName?: RedirectPolicyName;
}

function normalizeToken(value: string | undefined): string | null {
  const token = value?.trim().toUpperCase().replace(/-/g, "_");
  return token || null;
}

export function parseMigrationProfileName(value: string | undefined): MigrationProfileName | null {
  const token = normalizeToken(value);
  if (token === "FULL_IMPORT" || token === "DEV_VALIDATION" || token === "PRODUCTION" || token === "PROD_IMPORT") {
    return token;
  }
  return null;
}

export function parseMediaPolicyName(value: string | undefined): MediaPolicyName | null {
  const token = normalizeToken(value);
  if (token === "FULL" || token === "METADATA" || token === "NONE") return token;
  return null;
}

export function parseSeoPolicyName(value: string | undefined): SeoPolicyName | null {
  const token = normalizeToken(value);
  if (token === "DRY_RUN" || token === "VALIDATE" || token === "PRODUCTION") return token;
  return null;
}

export function parseRedirectPolicyName(value: string | undefined): RedirectPolicyName | null {
  const token = normalizeToken(value);
  if (token === "VALIDATE" || token === "APPLY") return token;
  return null;
}

export function resolveMigrationEnvironment(env: NodeJS.ProcessEnv = process.env): MigrationEnvironment {
  const appEnv = normalizeToken(env.APP_ENV);
  const vercelEnv = normalizeToken(env.VERCEL_ENV);

  if (appEnv === "PROD" || appEnv === "PRODUCTION" || vercelEnv === "PRODUCTION") {
    return "PROD";
  }
  if (
    appEnv === "DEV" ||
    appEnv === "DEVELOPMENT" ||
    appEnv === "STAGING" ||
    vercelEnv === "PREVIEW" ||
    vercelEnv === "DEVELOPMENT"
  ) {
    return "DEV";
  }
  return "LOCAL";
}

export function defaultProfileNameForEnvironment(environment: MigrationEnvironment): MigrationProfileName {
  if (environment === "PROD") return "PRODUCTION";
  if (environment === "DEV") return "DEV_VALIDATION";
  return "FULL_IMPORT";
}

export function resolveMigrationProfile(input: ResolveMigrationProfileInput = {}): MigrationProfile {
  const environment = resolveMigrationEnvironment(input.env);
  const profileName = input.profileName ?? defaultProfileNameForEnvironment(environment);
  const defaults = PROFILE_DEFAULTS[profileName];

  return {
    name: profileName,
    environment,
    mediaPolicy: MEDIA_POLICIES[input.mediaPolicyName ?? defaults.mediaPolicy],
    seoPolicy: SEO_POLICIES[input.seoPolicyName ?? defaults.seoPolicy],
    redirectPolicy: REDIRECT_POLICIES[input.redirectPolicyName ?? defaults.redirectPolicy],
    validateOnly: defaults.validateOnly,
  };
}

export function formatMigrationProfileForCli(profile: MigrationProfile): string {
  return [
    "Migration Profile:",
    `  Profile: ${profile.name}`,
    `  Environment: ${profile.environment}`,
    `  Media: ${profile.mediaPolicy.name}`,
    `  SEO: ${profile.seoPolicy.name}`,
    `  Redirects: ${profile.redirectPolicy.name}`,
    `  Validate only: ${profile.validateOnly ? "YES" : "NO"}`,
  ].join("\n");
}
