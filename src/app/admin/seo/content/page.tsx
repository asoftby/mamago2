import { SeoContentFoundationClient } from "@/components/admin/seo/SeoContentFoundationClient";
import {
  formatSeoGeoContextBreadcrumb,
} from "@/lib/admin/seo/geo";
import { resolveSeoGeoSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";

export default async function AdminSeoContentPage() {
  const { context } = await resolveSeoGeoSession();
  return (
    <SeoContentFoundationClient
      breadcrumb={formatSeoGeoContextBreadcrumb(context)}
    />
  );
}
