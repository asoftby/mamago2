import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";

export function useFilterUpdater() {
  const { setDraft } = useDiscoveryFilters();

  // Update draft state instead of URL directly
  const updateFilters = (patch: any) => {
    console.log('updateFilters called with patch:', patch);
    setDraft(patch);
  };

  return { updateFilters };
}