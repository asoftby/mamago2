import { OccasionEditPage } from "../../_components/OccasionEditPage";

export default function DiscoveryOccasionEditPage() {
  return (
    <OccasionEditPage
      listHrefBase="/admin/discovery/occasions"
      listLabel="← К списку поводов"
      entityLabel="повод"
    />
  );
}
