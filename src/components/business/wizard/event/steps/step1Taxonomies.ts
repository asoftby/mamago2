export type DiscoveryEventCategory = {
  id: string;
  nameRu: string;
  slug: string;
  icon?: string | null;
  supportsProgram?: boolean;
  selectableInProgram?: boolean;
  parentId: string | null;
  sortOrder: number;
  children?: DiscoveryEventCategory[];
};

export type PublicAgeOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean;
};

export type PublicInterestOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean;
};

export type PublicGenreOption = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

export type EventStep1Taxonomies = {
  categories: DiscoveryEventCategory[];
  ageOptions: PublicAgeOption[];
  interestOptions: PublicInterestOption[];
  genresByCategoryId?: Record<string, PublicGenreOption[]>;
};
