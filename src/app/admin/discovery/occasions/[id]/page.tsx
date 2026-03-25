import { DiscoveryFlatTaxonomyEditPage } from "../../_components/DiscoveryFlatTaxonomyEditPage";

export default function DiscoveryOccasionEditPage() {
  return (
    <DiscoveryFlatTaxonomyEditPage
      listHref="/admin/discovery/occasions"
      listLabel="← К списку поводов"
      entityLabel="повод"
    />
  );
}
