import { permanentRedirect } from "next/navigation";
import { searchParamsToSuffix } from "@/lib/navigation/searchParamsToSuffix";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Совместимость: единый канонический URL — `/[city]/events`. */
export default async function WhereToGoPage({ params, searchParams }: PageProps) {
  const { city: citySlug } = await params;
  const resolvedSearchParams = await searchParams;
  permanentRedirect(`/${citySlug}/events${searchParamsToSuffix(resolvedSearchParams)}`);
}
