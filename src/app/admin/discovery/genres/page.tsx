import { DiscoveryFlatTaxonomyAdminPage } from "../_components/DiscoveryFlatTaxonomyAdminPage";

export default function DiscoveryGenresPage() {
  return (
    <DiscoveryFlatTaxonomyAdminPage
      axis="GENRE"
      title="Taxonomy: Genres"
      description="Плоский справочник жанров и характера контента (комедия, драма…). Универсальная ось, не привязана к категории."
      createCardTitle="Create New Genre"
      listSegment="genres"
    />
  );
}
