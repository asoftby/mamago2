import { BUSINESS_PATH_PREFIX } from "@/lib/routing/surface";

/**
 * Маршруты под /business, где режим «личный» допустим (онбординг, статусы и т.д.).
 * Остальные /business/* при активном личном режиме → синхронизация в бизнес-режим (см. AccountModeProvider).
 */
const BUSINESS_PATHS_ALLOWED_IN_PERSONAL_MODE = [
  `${BUSINESS_PATH_PREFIX}/onboarding`,
  `${BUSINESS_PATH_PREFIX}/verification`,
  `${BUSINESS_PATH_PREFIX}/suspended`,
  `${BUSINESS_PATH_PREFIX}/pricing`,
  `${BUSINESS_PATH_PREFIX}/pending`,
] as const;

export function isBusinessPathAllowedInPersonalMode(pathname: string): boolean {
  return BUSINESS_PATHS_ALLOWED_IN_PERSONAL_MODE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function shouldRedirectPersonalModeAwayFromBusiness(
  pathname: string,
): boolean {
  if (!pathname.startsWith(BUSINESS_PATH_PREFIX)) return false;
  return !isBusinessPathAllowedInPersonalMode(pathname);
}
