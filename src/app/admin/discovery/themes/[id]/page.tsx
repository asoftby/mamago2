import { DiscoveryFlatTaxonomyEditPage } from "../../_components/DiscoveryFlatTaxonomyEditPage";

export default function DiscoveryThemeEditPage() {
  return (
    <DiscoveryFlatTaxonomyEditPage
      listHref="/admin/discovery/themes"
      listLabel="← К списку тем"
      entityLabel="тему"
    />
  );
}
