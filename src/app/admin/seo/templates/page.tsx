import { SeoTemplatesClient } from "@/components/admin/seo/SeoTemplatesClient";
import { getSeoTemplates } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoTemplatesPage() {
  const templates = await getSeoTemplates();
  console.log("[API] real data used", { endpoint: "admin-seo-templates", count: templates.length });
  return <SeoTemplatesClient initialTemplates={templates} />;
}
