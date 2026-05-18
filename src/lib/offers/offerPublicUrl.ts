import type { Offer, OfferKind } from "@prisma/client";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

export type OfferPublicSection = "camps" | "programs" | "events" | "birthday" | "services";

/**
 * Определяет публичную секцию для Offer на основе его типа и характеристик.
 * 
 * Правила:
 * course + campProgramType exists -> camps
 * course + recurring -> programs
 * course + single -> events
 * birthday -> birthday
 * service -> services
 */
export function getOfferPublicSection(offer: {
  kind: string;
  durationType?: string | null;
  campProgramType?: string | null;
}): OfferPublicSection {
  const kind = offer.kind;

  if (offer.campProgramType) return "camps";

  if (kind === "CLASS" || kind === "course") {
    if (offer.durationType === "single") return "events";
    return "programs";
  }

  if (kind === "PARTY" || kind === "birthday") {
    return "birthday";
  }

  if (kind === "VISIT" || kind === "service") {
    return "services";
  }

  if (kind === "SERVICE") {
    return "programs";
  }

  if (kind === "EVENT") {
    return "events";
  }

  return "programs";
}

/**
 * Возвращает канонический публичный путь для Offer.
 * Формат: /[city]/offers/[section]/[slug]
 */
export function getOfferPublicPath(
  offer: { kind: string; durationType?: string | null; campProgramType?: string | null; slug: string | null },
  citySlug: string
): string {
  if (!offer.slug) return `/${citySlug}`;
  const section = getOfferPublicSection(offer);
  return `/${citySlug}/offers/${section}/${offer.slug}`;
}

/**
 * Возвращает абсолютный публичный URL для Offer (с учетом домена).
 * Полезно для ссылок из поддоменов (business, admin) на основной сайт.
 */
export function getOfferPublicUrl(
  offer: { kind: string; durationType?: string | null; campProgramType?: string | null; slug: string | null },
  citySlug: string
): string {
  const path = getOfferPublicPath(offer, citySlug);
  const base = getCanonicalPublicAppUrl();
  return `${base}${path}`;
}

/**
 * Валидирует строку секции.
 */
export function parseOfferPublicSection(section: string): OfferPublicSection | null {
  const validSections: OfferPublicSection[] = ["camps", "programs", "events", "birthday", "services"];
  if (validSections.includes(section as OfferPublicSection)) {
    return section as OfferPublicSection;
  }
  return null;
}
