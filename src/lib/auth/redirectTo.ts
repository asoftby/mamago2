/** Query param for post-auth return destination (canonical). */
export const REDIRECT_TO_PARAM = "redirectTo";

/** Legacy query param — still accepted when reading, not written to new URLs. */
export const LEGACY_NEXT_PARAM = "next";

/** Auth-flow pages themselves are never valid redirect targets (would loop back into auth). */
const AUTH_REDIRECT_DENYLIST = ["/auth", "/login", "/register", "/profile-entry"];

function isDenylistedRedirectPath(path: string): boolean {
  return AUTH_REDIRECT_DENYLIST.some(
    (denied) => path === denied || path.startsWith(`${denied}/`) || path.startsWith(`${denied}?`),
  );
}

export type AuthUrlMode = "login" | "register";

type SearchParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(source: SearchParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) {
    const value = source.get(key);
    return value && value.length > 0 ? value : undefined;
  }
  const raw = source[key];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].length > 0) {
    return raw[0];
  }
  return undefined;
}

/**
 * Validates redirect target: internal relative path only (no open redirects),
 * and not an auth-flow page itself (no redirect loops back into login/register).
 */
export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value || typeof value !== "string") return fallback;

  let candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (candidate.includes("://")) return fallback;

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (candidate.includes("://")) return fallback;
  if (isDenylistedRedirectPath(candidate)) return fallback;

  return candidate;
}

/**
 * Reads redirect destination from query params (`redirectTo` preferred, `next` legacy).
 */
export function readRedirectParam(source: SearchParamSource): string | undefined {
  return readParam(source, REDIRECT_TO_PARAM) ?? readParam(source, LEGACY_NEXT_PARAM);
}

export function readRedirectParamWithFallback(
  source: SearchParamSource,
  fallback: string,
): string {
  return getSafeRedirectPath(readRedirectParam(source), fallback);
}

export interface BuildAuthUrlOptions {
  mode?: AuthUrlMode;
  redirectTo?: string | null;
  /** Extra query params (e.g. email, invitationToken, from=admin). */
  extra?: Record<string, string | undefined>;
}

/**
 * Builds login or register URL with safe `redirectTo`.
 * Register resolves to `/login?mode=register&redirectTo=…` (same as /register alias page).
 */
export function buildAuthUrl(options: BuildAuthUrlOptions = {}): string {
  const { mode = "login", redirectTo, extra } = options;
  const params = new URLSearchParams();

  if (mode === "register") {
    params.set("mode", "register");
  }

  const safeRedirect = redirectTo ? getSafeRedirectPath(redirectTo, "") : "";
  if (safeRedirect) {
    params.set(REDIRECT_TO_PARAM, safeRedirect);
  }

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  if (mode === "register") {
    return qs.length > 0 ? `/register?${qs}` : "/register";
  }
  return qs.length > 0 ? `/login?${qs}` : "/login";
}

/** Client helper: current pathname + search without origin. */
export function buildCurrentPath(pathname: string, search?: string | null): string {
  if (!search || search.length === 0) return pathname;
  return search.startsWith("?") ? `${pathname}${search}` : `${pathname}?${search}`;
}
