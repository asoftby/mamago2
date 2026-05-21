import type { Metadata } from "next";
import { CityShell } from "@/components/city/CityShell";
import { buildCityEventsListingMetadata } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: citySlug } = await params;
  return applyGlobalRobotsOverride(await buildCityEventsListingMetadata(citySlug));
}

/**
 * Каноническая страница интента «Куда пойти» (афиша / discovery).
 * `/[city]/kuda` и корень `/[city]` указывают сюда через canonical или redirect.
 */
export default async function CityEventsListingPage({
  params,
  searchParams,
}: PageProps) {
  const { city: citySlug } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <CityShell
      citySlug={citySlug}
      intent="kuda"
      searchParams={resolvedSearchParams}
    />
  );
}
