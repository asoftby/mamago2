import type { Metadata } from "next";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getBaseUrl } from "@/lib/routing/cityPaths";

/** Canonical base URL for the public site (BY). */
export function publicSiteBase(): string {
  return getBaseUrl("BY");
}

/** Canonical path for the city events listing. */
export function cityEventsListingPath(citySlug: string): string {
  return `/${citySlug}/events`;
}

/** Metadata for `/{city}/events` — primary indexable intent «kuda». */
export async function buildCityEventsListingMetadata(
  citySlug: string,
): Promise<Metadata> {
  const city = await findCityBySlug(citySlug, { select: { name: true } });
  if (!city) return {};
  const base = publicSiteBase();
  const canonical = `${base}${cityEventsListingPath(citySlug)}`;
  return {
    title: `Куда пойти с ребёнком в ${city.name} — mamaGo`,
    description: `Афиша семейных событий, места и развлечения для детей в ${city.name}. Фильтры по возрасту и району.`,
    alternates: { canonical },
  };
}

/**
 * Self-canonical metadata for the city hub `/{city}`.
 * The hub is its own rankable page — NOT a redirect/alias to /events.
 */
export async function buildCityHubMetadata(citySlug: string): Promise<Metadata> {
  const city = await findCityBySlug(citySlug, { select: { name: true } });
  if (!city) return {};
  const base = publicSiteBase();
  const canonical = `${base}/${citySlug}`;
  return {
    title: `${city.name} — семейный гид | mamaGo`,
    description: `Афиша событий, занятия, маршруты и журнал mamaGo — городской хаб для семей с детьми в ${city.name}.`,
    alternates: { canonical },
  };
}
