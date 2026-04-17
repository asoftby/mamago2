import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";

type FilterPatch = Record<string, string | number | boolean | null | undefined>;

export function useFilterUpdater() {
  const { setDraft } = useDiscoveryFilters();

  const updateFilters = (patch: FilterPatch) => {
    console.log('updateFilters called with patch:', patch);
    setDraft(patch);
  };

  return { updateFilters };
}