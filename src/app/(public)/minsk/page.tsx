import { CityShell } from "@/components/city/CityShell";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function MinskPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <CityShell
      citySlug="minsk"
      intent="kuda"
      searchParams={resolvedSearchParams}
    />
  );
}
