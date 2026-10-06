import { StructuredDataCenterClient } from "@/components/admin/seo/StructuredDataCenterClient";
import { getStructuredDataCenterData } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoSchemaSettingsPage() {
  const data = await getStructuredDataCenterData();
  return (
    <StructuredDataCenterClient
      initialOverviewCards={data.overviewCards}
      initialTemplates={data.templates}
      initialValidation={data.validation}
    />
  );
}
