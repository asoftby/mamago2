import { DiscoveryFlatTaxonomyAdminPage } from "../_components/DiscoveryFlatTaxonomyAdminPage";

export default function DiscoveryThemesPage() {
  return (
    <DiscoveryFlatTaxonomyAdminPage
      axis="THEME"
      title="Taxonomy: Themes"
      description="Плоский справочник тематики контента (наука, спорт, музыка…). Не категория события. Вложенности нет."
      createCardTitle="Create New Theme"
      listSegment="themes"
    />
  );
}
