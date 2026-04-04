import type { Metadata } from "next";
import prisma from "@/lib/prisma";

export function publicSiteBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://mamago.by";
}

/** Канонический URL листинга «Куда пойти» / афиши событий в городе. */
export function cityEventsListingPath(citySlug: string): string {
  return `/${citySlug}/events`;
}

/** Metadata для `/{city}/events` — основная индексируемая витрина intent «kuda». */
export async function buildCityEventsListingMetadata(
  citySlug: string,
): Promise<Metadata> {
  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
    select: { name: true },
  });
  if (!city) return {};
  const base = publicSiteBase();
  const canonical = `${base}${cityEventsListingPath(citySlug)}`;
  return {
    title: `Куда пойти с ребёнком в ${city.name} — mamaGo`,
    description: `Афиша семейных событий, места и развлечения для детей в ${city.name}. Фильтры по возрасту и району.`,
    alternates: { canonical },
  };
}

/** Корень города дублирует контент kuda — canonical на листинг `/events`. */
export async function buildCityHomeCanonicalToEvents(
  citySlug: string,
): Promise<Metadata> {
  const city = await prisma.city.findUnique({
    where: { slug: citySlug },
    select: { id: true },
  });
  if (!city) return {};
  const base = publicSiteBase();
  return {
    alternates: { canonical: `${base}${cityEventsListingPath(citySlug)}` },
  };
}
