import { SitemapRobotsCenterClient } from "@/components/admin/seo/SitemapRobotsCenterClient";
import { getSitemapRobotsData } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoSitemapPage() {
  const data = await getSitemapRobotsData();
  console.log("[API] real data used", { endpoint: "admin-seo-sitemap", empty: true });
  return (
    <SitemapRobotsCenterClient
      initialStatus={data.status}
      initialSections={data.sections}
      initialRobots={data.robots}
    />
  );
}
