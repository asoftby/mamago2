import { SitemapRobotsCenterClient } from "@/components/admin/seo/SitemapRobotsCenterClient";
import {
  MOCK_ROBOTS_SETTINGS,
  MOCK_SITEMAP_SECTIONS,
  MOCK_SITEMAP_STATUS,
} from "@/lib/admin/seo/sitemapRobotsMock";

export default function AdminSeoSitemapPage() {
  return (
    <SitemapRobotsCenterClient
      initialStatus={MOCK_SITEMAP_STATUS}
      initialSections={MOCK_SITEMAP_SECTIONS}
      initialRobots={MOCK_ROBOTS_SETTINGS}
    />
  );
}
