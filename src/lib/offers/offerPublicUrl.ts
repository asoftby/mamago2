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
 * Формат: /[city]/offers/[slug]
 *
 * `{section}` (see `getOfferPublicSection` above) is deliberately NOT part
 * of the canonical identity — it's a mutable product taxonomy/filter
 * concept computed from `kind`/`durationType`/`campProgramType`, which can
 * evolve or be edited without changing the Offer's permanent URL. See
 * `docs/migration/seo/final-url-architecture-2026-08-15.md` §3 /
 * BACKLOG-116.
 */
export function getOfferPublicPath(
  offer: { slug: string | null },
  citySlug: string
): string {
  if (!offer.slug) return `/${citySlug}`;
  return `/${citySlug}/offers/${offer.slug}`;
}

/**
 * Возвращает абсолютный публичный URL для Offer (с учетом домена).
 * Полезно для ссылок из поддоменов (business, admin) на основной сайт.
 */
export function getOfferPublicUrl(
  offer: { slug: string | null },
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
