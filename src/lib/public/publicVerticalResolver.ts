/**
 * Public Vertical Resolver
 * 
 * Определяет user-facing vertical для internal entities:
 * - Activity type=EVENT → EVENT vertical → /[city]/events/[slug]
 * - Activity type=OFFER → PROGRAM vertical → /[city]/programs/[slug]
 * - Place → PLACE vertical → /[city]/places/[slug]
 * 
 * PROGRAM vertical включает:
 * - Лагеря (CAMP)
 * - Курсы (REGULAR)
 * - Регулярные занятия (REGULAR)
 * - Разовые занятия (SINGLE)
 * - Абонементы, интенсивы
 */

import type { ActivityType } from "@prisma/client";

/**
 * User-facing verticals
 */
export type PublicVertical = "EVENT" | "PROGRAM" | "PLACE" | "GETAWAY";

/**
 * Offer wizard types (из business wizard)
 */
export type OfferWizardType = "SINGLE" | "REGULAR" | "CAMP";

/**
 * Определяет public vertical для Activity
 */
export function resolveActivityVertical(
  activityType: ActivityType,
  offerWizardType?: string | null
): PublicVertical {
  // EVENT остаётся EVENT
  if (activityType === "EVENT") {
    return "EVENT";
  }

  // OFFER всегда становится PROGRAM
  // (в будущем можем добавить логику для GETAWAY)
  if (activityType === "OFFER") {
    return "PROGRAM";
  }

  // COURSE, PERMANENT тоже могут быть PROGRAM
  if (activityType === "COURSE" || activityType === "PERMANENT") {
    return "PROGRAM";
  }

  // ROUTE пока не обрабатываем
  // По умолчанию EVENT
  return "EVENT";
}

/**
 * Определяет public vertical для Place
 */
export function resolvePlaceVertical(): PublicVertical {
  return "PLACE";
}

/**
 * Генерирует public path для Activity
 */
export function buildActivityPublicPath(
  citySlug: string,
  slug: string,
  activityType: ActivityType,
  offerWizardType?: string | null
): string {
  const vertical = resolveActivityVertical(activityType, offerWizardType);

  switch (vertical) {
    case "EVENT":
      return `/${citySlug}/events/${slug}`;
    case "PROGRAM":
      return `/${citySlug}/programs/${slug}`;
    case "GETAWAY":
      return `/${citySlug}/getaways/${slug}`;
    default:
      return `/${citySlug}/events/${slug}`;
  }
}

/**
 * Генерирует public path для Place
 */
export function buildPlacePublicPath(citySlug: string, slug: string): string {
  return `/${citySlug}/places/${slug}`;
}

/**
 * Проверяет, является ли Activity программой (PROGRAM vertical)
 */
export function isProgram(
  activityType: ActivityType,
  offerWizardType?: string | null
): boolean {
  return resolveActivityVertical(activityType, offerWizardType) === "PROGRAM";
}

/**
 * Проверяет, является ли Activity событием (EVENT vertical)
 */
export function isEvent(
  activityType: ActivityType,
  offerWizardType?: string | null
): boolean {
  return resolveActivityVertical(activityType, offerWizardType) === "EVENT";
}

/**
 * Человекочитаемое название типа программы
 */
export function getProgramTypeLabel(offerWizardType?: string | null): string {
  if (!offerWizardType) return "Программа";

  const labels: Record<string, string> = {
    CAMP: "Лагерь",
    REGULAR: "Регулярные занятия",
    SINGLE: "Разовое занятие",
  };

  return labels[offerWizardType] || "Программа";
}

/**
 * Получает базовый путь для vertical
 */
export function getVerticalBasePath(
  citySlug: string,
  vertical: PublicVertical
): string {
  switch (vertical) {
    case "EVENT":
      return `/${citySlug}/events`;
    case "PROGRAM":
      return `/${citySlug}/programs`;
    case "PLACE":
      return `/${citySlug}/places`;
    case "GETAWAY":
      return `/${citySlug}/getaways`;
    default:
      return `/${citySlug}`;
  }
}
