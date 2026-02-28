import { CityShell } from "@/components/city/CityShell";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CityPage({ params, searchParams }: PageProps) {
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
