import { SeoTemplatesClient } from "@/components/admin/seo/SeoTemplatesClient";
import { MOCK_SEO_TEMPLATES } from "@/lib/admin/seo/seoTemplateMock";

export default function AdminSeoTemplatesPage() {
  return <SeoTemplatesClient initialTemplates={MOCK_SEO_TEMPLATES} />;
}
