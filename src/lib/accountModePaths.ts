/**
 * Маршруты под /business, где режим «личный» допустим (онбординг, статусы и т.д.).
 * Остальные /business/* при активном личном режиме → редирект на /me.
 */
const BUSINESS_PATHS_ALLOWED_IN_PERSONAL_MODE = [
  "/business/onboarding",
  "/business/verification",
  "/business/suspended",
  "/business/pricing",
  "/business/pending",
] as const;

export function isBusinessPathAllowedInPersonalMode(pathname: string): boolean {
  return BUSINESS_PATHS_ALLOWED_IN_PERSONAL_MODE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function shouldRedirectPersonalModeAwayFromBusiness(
  pathname: string,
): boolean {
  if (!pathname.startsWith("/business")) return false;
  return !isBusinessPathAllowedInPersonalMode(pathname);
}
