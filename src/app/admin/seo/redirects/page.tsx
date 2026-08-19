import { RedirectCenterClient } from "@/components/admin/seo/RedirectCenterClient";
import { getRedirectCenterData } from "@/lib/admin/seo/data/seoAdminData";
import { parseAdminPage } from "@/lib/admin/pagination";
import type { RedirectDisposition } from "@/lib/admin/seo/domain/types";

export const dynamic = "force-dynamic";

const VALID_FILTERS: ReadonlySet<string> = new Set([
  "EXACT_REDIRECT",
  "VALID_HUB_REMAP",
  "P1_START_OR_CONTAINS",
  "INVALID_TARGET",
  "COLLISION",
  "CHAIN",
  "LOOP",
]);

interface PageProps {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}

export default async function AdminSeoRedirectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseAdminPage(params.page);
  const search = params.q?.trim() || undefined;
  const filter: RedirectDisposition | "ALL" = VALID_FILTERS.has(params.filter ?? "")
    ? (params.filter as RedirectDisposition)
    : "ALL";

  const data = await getRedirectCenterData({ search, filter, page });

  return (
    <RedirectCenterClient
      automatic={data.automatic}
      automaticPagination={data.automaticPagination}
      manual={data.manual}
      summary={data.summary}
      currentSearch={search ?? ""}
      currentFilter={filter}
      currentParams={params}
    />
  );
}
