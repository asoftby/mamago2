export type DiscoveryFiltersState = {
  when: string | null;
  age: string[];
  districtId: string | null;
  metroId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export type DiscoveryFilterKey = keyof DiscoveryFiltersState;
