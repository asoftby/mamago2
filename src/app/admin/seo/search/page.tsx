import { SeoSearchFoundationClient } from "@/components/admin/seo/SeoSearchFoundationClient";
import {
  formatSeoGeoContextBreadcrumb,
} from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";

export default async function AdminSeoSearchPage() {
  const { context } = await resolveSeoGeoSession();
  return (
    <SeoSearchFoundationClient
      breadcrumb={formatSeoGeoContextBreadcrumb(context)}
    />
  );
}
