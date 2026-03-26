import { Button } from "@/components/ui/button";
import { SeoPagesClient } from "@/components/admin/seo/SeoPagesClient";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { getSeoPages } from "@/lib/admin/seo/data/seoAdminData";

export default async function AdminSeoPagesPage() {
  const rows = await getSeoPages();
  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="SEO Pages"
        subtitle="Единый SEO control center: управляемые SEO-посадки + публичные страницы сущностей (events/places/…)"
        actions={
          <Button type="button" disabled className="shrink-0">
            Создать SEO Page
          </Button>
        }
      />
      <p className="-mt-4 text-xs text-gray-400">
        Кнопка «Создать SEO Page» — только для manual landing pages. Сущности (event/place/…) редактируются через Edit SEO.
      </p>

      {/* Note: server-side fetch; client handles filtering */}
      <SeoPagesClient initialRows={rows} />
    </div>
  );
}
