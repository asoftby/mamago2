import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getBrandingConfig } from "@/lib/branding";
import { BrandingForm } from "./BrandingForm";

export default async function AdminBrandingPage() {
  const branding = await getBrandingConfig();

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminPageHeader
        title="Оформление"
        subtitle="Логотип, фавикон, цвета и типографика сайта"
        backHref="/admin"
      />
      <BrandingForm initial={branding} />
    </div>
  );
}
