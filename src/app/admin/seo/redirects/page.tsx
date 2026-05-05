import { RedirectCenterClient } from "@/components/admin/seo/RedirectCenterClient";
import { getRedirectCenterData } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoRedirectsPage() {
  const data = await getRedirectCenterData();
  console.log("[API] real data used", { endpoint: "admin-seo-redirects", empty: true });
  return (
    <RedirectCenterClient
      initialAutomatic={data.automatic}
      initialManual={data.manual}
      initialUnmatched={data.unmatched}
    />
  );
}
