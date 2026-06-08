import { CityShell } from "@/components/city/CityShell";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BirthdayPage({ params, searchParams }: PageProps) {
  const { city: citySlug } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:px-8">
        <MobileSmartBackButton fallbackUrl={`/${citySlug}`} />
      </div>
      <CityShell
        citySlug={citySlug}
        intent="birthday"
        searchParams={resolvedSearchParams}
      />
    </>
  );
}
