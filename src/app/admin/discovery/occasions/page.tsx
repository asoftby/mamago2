import { DiscoveryFlatTaxonomyAdminPage } from "../_components/DiscoveryFlatTaxonomyAdminPage";

export default function DiscoveryOccasionsPage() {
  return (
    <DiscoveryFlatTaxonomyAdminPage
      axis="OCCASION"
      title="Taxonomy: Occasions"
      description="Плоский справочник календарных поводов и триггеров (праздники, сезоны) для подборок и SEO. Вложенности нет — колонка «Родитель» всегда пустая."
      createCardTitle="Create New Occasion"
      listSegment="occasions"
    />
  );
}
