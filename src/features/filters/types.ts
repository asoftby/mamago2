export type FilterKey = string;

export type FilterMode = "single" | "multi";

export interface Option {
  value: string;
  label: string;
}

export interface FilterDef {
  key: FilterKey;
  label: string;
  mode: FilterMode;
  options: Option[];
  placeholder?: string;
  queryParam?: string; // defaults to key
}

export type AppliedState = Record<FilterKey, string | string[] | null>;
