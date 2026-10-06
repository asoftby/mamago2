import { SitemapRobotsCenterClient } from "@/components/admin/seo/SitemapRobotsCenterClient";
import { getSitemapRobotsData } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoIndexationSettingsPage() {
  const data = await getSitemapRobotsData();
  return (
    <SitemapRobotsCenterClient
      initialStatus={data.status}
      initialSections={data.sections}
      initialRobots={data.robots}
    />
  );
}
