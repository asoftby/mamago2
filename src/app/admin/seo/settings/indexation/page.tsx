import { IndexationSettingsClient } from "@/components/admin/seo/IndexationSettingsClient";
import { getSitemapRobotsData } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoIndexationSettingsPage() {
  const data = await getSitemapRobotsData();
  return (
    <IndexationSettingsClient
      robots={data.robots}
      sitemapUrl={data.status.sitemapUrl}
    />
  );
}
