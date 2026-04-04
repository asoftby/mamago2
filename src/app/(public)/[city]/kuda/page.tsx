import { permanentRedirect } from "next/navigation";
import { searchParamsToSuffix } from "@/lib/navigation/searchParamsToSuffix";

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * UX: breadcrumb «События» ведёт сюда; SEO: канонический URL — `/[city]/events`.
 */
export default async function CityKudaAliasRedirect({
  params,
  searchParams,
}: PageProps) {
  const { city } = await params;
  const sp = await searchParams;
  permanentRedirect(`/${city}/events${searchParamsToSuffix(sp)}`);
}
