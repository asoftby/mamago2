import type { Metadata } from "next";
import { CityShell } from "@/components/city/CityShell";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import { buildCityBirthdayListingMetadata } from "@/lib/seo/cityKudaListingMetadata";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { PERMANENT_NOINDEX_ROBOTS } from "@/lib/seo/indexingPolicy";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const metadata = await buildCityBirthdayListingMetadata(citySlug);
  return applyGlobalRobotsOverride({
    ...metadata,
    robots: PERMANENT_NOINDEX_ROBOTS,
  });
}

export default async function BirthdayPage({ params, searchParams }: PageProps) {
  const { city: citySlug } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:px-8">
        <MobileSmartBackButton fallbackHref={`/${citySlug}`} />
      </div>
      <CityShell
        citySlug={citySlug}
        intent="birthday"
        searchParams={resolvedSearchParams}
      />
    </>
  );
}
