import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CityShell } from "@/components/city/CityShell";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { listDiscoveryClassChips } from "@/server/discovery/classChips";
import { getClassesListingPage } from "@/server/discovery/classesListingPage";
import { getCityDisplayName } from "@/lib/city/cityDisplayNames";
import { publicSiteBase } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

type PageProps = {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolveCategory(citySlug: string, slug: string) {
  const [city, chips] = await Promise.all([
    findCityBySlug(citySlug),
    listDiscoveryClassChips(),
  ]);
  if (!city) notFound();
  const category = chips.find((chip) => chip.slug === slug && chip.isActive && chip.slug !== "all");
  if (!category) notFound();
  return { city, category, chips };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { city: citySlug, category: slug } = await params;
  const query = await searchParams;
  const { city, category, chips } = await resolveCategory(citySlug, slug);
  const listing = await getClassesListingPage(city.id, city.slug, {
    page: 1,
    chipSlug: category.slug,
    chipTitleBySlug: new Map(chips.map((chip) => [chip.slug, chip.title])),
    free: false,
    priceMax: null,
  });
  const cityName = getCityDisplayName(citySlug);
  const path = `/${citySlug}/classes/${category.slug}`;
  const hasFilters = Object.keys(query).some((key) => !["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].includes(key));
  const metadata: Metadata = {
    title: `${category.title} для детей в ${cityName} — mamaGo`,
    description: category.description?.trim() || `${category.title} для детей в ${cityName}: занятия, расписание, цены и предложения организаторов на mamaGo.`,
    alternates: { canonical: `${publicSiteBase()}${path}` },
    robots: listing.total === 0 || hasFilters ? { index: false, follow: true } : { index: true, follow: true },
  };
  return applyGlobalRobotsOverride(metadata);
}

export default async function ClassesCategoryPage({ params, searchParams }: PageProps) {
  const { city: citySlug, category: slug } = await params;
  const query = await searchParams;
  if (slug === "all") permanentRedirect(`/${citySlug}/classes`);
  const { category } = await resolveCategory(citySlug, slug);
  return (
    <CityShell
      citySlug={citySlug}
      intent="classes"
      searchParams={{ ...query, chip: category.slug }}
      pageTitleOverride={`${category.title} для детей в ${getCityDisplayName(citySlug)}`}
    />
  );
}
