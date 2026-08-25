import type { Metadata } from "next";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getBaseUrl, buildCityPublicUrl } from "@/lib/routing/cityPaths";
import { formatCityTitle, getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";

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
  const cityName = getCityDisplayName(citySlug);
  return {
    title: `Куда пойти с ребёнком в ${cityName} — mamaGo`,
    description: `Афиша семейных событий, места и развлечения для детей в ${cityName}. Фильтры по возрасту и району.`,
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
  const cityName = getCityDisplayName(citySlug);
  return {
    title: `mamaGo — куда сходить в ${cityName} с ребёнком или всей семьёй`,
    description: `mamaGo — удобный помощник в организации семейного отдыха и развития в ${cityName}: события, места, занятия, маршруты и идеи для времени с детьми.`,
    alternates: { canonical },
  };
}

/**
 * Metadata for `/{city}/classes` — reuses the same title template that
 * already backs the page's own H1 (`DISCOVERY_INTENT_CONFIG.classes`,
 * consumed by `CityDiscoveryShell`), so `<title>` and the visible heading
 * never drift apart.
 */
export async function buildCityClassesListingMetadata(
  citySlug: string,
): Promise<Metadata> {
  const city = await findCityBySlug(citySlug, { select: { name: true } });
  if (!city) return {};
  const canonical = buildCityPublicUrl({ citySlug, type: "classes" });
  const title = `${formatCityTitle(DISCOVERY_INTENT_CONFIG.classes.titleTemplate, citySlug)} — mamaGo`;
  return {
    title,
    description: `Кружки, секции и творческие занятия для детей в ${getCityDisplayName(citySlug)}: подборка по возрасту и формату.`,
    alternates: { canonical },
  };
}

/**
 * Metadata for `/{city}/birthday` — same H1-matching approach as classes.
 */
export async function buildCityBirthdayListingMetadata(
  citySlug: string,
): Promise<Metadata> {
  const city = await findCityBySlug(citySlug, { select: { name: true } });
  if (!city) return {};
  const canonical = buildCityPublicUrl({ citySlug, type: "birthday" });
  const title = `${formatCityTitle(DISCOVERY_INTENT_CONFIG.birthday.titleTemplate, citySlug)} — mamaGo`;
  return {
    title,
    description: `Идеи, площадки и услуги для организации детского дня рождения в ${getCityDisplayName(citySlug)}.`,
    alternates: { canonical },
  };
}

/**
 * Metadata for the city-scoped routes listing `/{city}/routes`. Distinct
 * from the global `/routes` listing and from `/routes/[slug]` detail pages
 * (which have their own canonical/JSON-LD, unchanged here).
 */
export async function buildCityRoutesListingMetadata(
  citySlug: string,
): Promise<Metadata> {
  const city = await findCityBySlug(citySlug, { select: { name: true } });
  if (!city) return {};
  const canonical = buildCityPublicUrl({ citySlug, type: "routes" });
  const title = `${formatCityTitle(DISCOVERY_INTENT_CONFIG.routes.titleTemplate, citySlug)} — mamaGo`;
  return {
    title,
    description: `Готовые маршруты для прогулок с детьми в ${getCityDisplayName(citySlug)}: несколько точек, бюджет и советы в одном месте.`,
    alternates: { canonical },
  };
}
