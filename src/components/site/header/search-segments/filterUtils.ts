import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useFilterUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilters = (patch: any) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Handle date filters
    if ('dateFrom' in patch) {
      if (patch.dateFrom) params.set("from", patch.dateFrom);
      else params.delete("from");
    }
    
    if ('dateTo' in patch) {
      if (patch.dateTo) params.set("to", patch.dateTo);
      else params.delete("to");
    }
    
    if ('whenPreset' in patch) {
      if (patch.whenPreset) params.set("preset", patch.whenPreset);
      else params.delete("preset");
    }
    
    // Handle location filters
    if ('metro' in patch) {
      if (patch.metro) params.set("metro", patch.metro);
      else params.delete("metro");
    }
    
    if ('district' in patch) {
      if (patch.district) params.set("district", patch.district);
      else params.delete("district");
    }
    
    // Handle age filters
    if ('age' in patch) {
      if (patch.age && patch.age.length > 0) {
        params.set("age", patch.age.join(","));
      } else {
        params.delete("age");
      }
    }
    
    // Clean up old params
    params.delete("when");
    params.delete("dateFrom");
    params.delete("dateTo");
    
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    
    router.replace(url, { scroll: false });
  };

  return { updateFilters };
}