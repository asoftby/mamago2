import { DiscoveryFlatTaxonomyEditPage } from "../../_components/DiscoveryFlatTaxonomyEditPage";

export default function DiscoveryGenreEditPage() {
  return (
    <DiscoveryFlatTaxonomyEditPage
      listHref="/admin/discovery/genres"
      listLabel="← К списку жанров"
      entityLabel="жанр"
    />
  );
}
