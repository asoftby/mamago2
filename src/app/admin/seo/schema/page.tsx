import { StructuredDataCenterClient } from "@/components/admin/seo/StructuredDataCenterClient";
import { getStructuredDataCenterData } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoSchemaPage() {
  const data = await getStructuredDataCenterData();
  console.log("[API] real data used", { endpoint: "admin-seo-schema", empty: true });
  return (
    <StructuredDataCenterClient
      initialOverviewCards={data.overviewCards}
      initialTemplates={data.templates}
      initialValidation={data.validation}
    />
  );
}
