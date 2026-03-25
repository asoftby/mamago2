import { Button } from "@/components/ui/button";
import { SeoPagesClient } from "@/components/admin/seo/SeoPagesClient";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { MOCK_SEO_PAGES } from "@/lib/admin/seo/mocks/pages";

export default function AdminSeoPagesPage() {
  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="SEO Pages"
        subtitle="Управляемые SEO-посадки и индексируемые страницы (preset, category, generated) — отдельно от сущностей контента"
        actions={
          <Button type="button" disabled className="shrink-0">
            Создать SEO Page
          </Button>
        }
      />
      <p className="-mt-4 text-xs text-gray-400">
        Не редактор событий и мест: это слой SEO landing pages и шаблонов выдачи.
      </p>

      <SeoPagesClient initialRows={MOCK_SEO_PAGES} />
    </div>
  );
}
