import {
  isBirthdayMakeWizardPath,
  isMyPlanShellExcludedPath,
  isPublicationDetailPath,
  shouldHideMobileBottomNav,
} from "@/lib/intent";

/**
 * Единственный липкий элемент внизу мобильного экрана (< lg).
 * - `plan` — пилюля «Мой план»;
 * - `purchase` — свой стики-бар покупки страницы (EventStickyActionBar и т.п.);
 * - `none` — внизу ничего (оформление, мастера, посадочные без плана, полноэкранный план).
 */
export type MobileBottomSlot = "plan" | "purchase" | "none";

/** Полноэкранные страницы плана: /me/plan, /me/day, /{city}/me/plan, /{city}/my-plan/... */
export function isMyPlanFullPageRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "me" && (segments[1] === "plan" || segments[1] === "day")) {
    return true;
  }
  if (
    segments.length >= 3 &&
    segments[1] === "me" &&
    (segments[2] === "plan" || segments[2] === "day")
  ) {
    return true;
  }
  if (segments.length >= 2 && segments[1] === "my-plan") return true;
  return false;
}

export function resolveMobileBottomSlot(pathname: string | null): MobileBottomSlot {
  if (!pathname) return "none";
  if (isMyPlanShellExcludedPath(pathname) || isBirthdayMakeWizardPath(pathname)) return "none";
  if (isPublicationDetailPath(pathname)) return "purchase";
  if (isMyPlanFullPageRoute(pathname)) return "none";
  if (shouldHideMobileBottomNav(pathname)) return "none";
  return "plan";
}
