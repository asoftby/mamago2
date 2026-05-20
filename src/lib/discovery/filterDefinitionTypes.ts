/** Allowed UI component types for FilterDefinition */
export const FILTER_UI_VALUES = [
  "chips",
  "tabs",
  "toggle",
  "switcher",
  "range",
  "checkboxes",
  "select",
  "multiselect",
] as const;

/** Allowed data types for FilterDefinition */
export const FILTER_TYPE_VALUES = [
  "single",
  "multiple",
  "boolean",
  "range",
] as const;

/** Allowed placement values (maps to Prisma UiPlacement enum uppercase keys) */
export const FILTER_PLACEMENT_VALUES = [
  "PRIMARY",
  "MODAL",
  "ADVANCED",
  "HIDDEN",
] as const;

export type FilterUi = (typeof FILTER_UI_VALUES)[number];
export type FilterType = (typeof FILTER_TYPE_VALUES)[number];
export type FilterPlacement = (typeof FILTER_PLACEMENT_VALUES)[number];

export const FILTER_UI_LABELS: Record<FilterUi, string> = {
  chips: "Chips",
  tabs: "Tabs",
  toggle: "Toggle",
  switcher: "Switcher",
  range: "Range",
  checkboxes: "Checkboxes",
  select: "Select",
  multiselect: "Multiselect",
};

export const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  single: "Single",
  multiple: "Multiple",
  boolean: "Boolean",
  range: "Range",
};

export const FILTER_PLACEMENT_LABELS: Record<FilterPlacement, string> = {
  PRIMARY: "Primary",
  MODAL: "Modal",
  ADVANCED: "Advanced",
  HIDDEN: "Hidden",
};

/** Which UI types are valid for each filter data type */
export const TYPE_UI_COMPATIBILITY: Record<FilterType, FilterUi[]> = {
  single: ["chips", "tabs", "select"],
  multiple: ["chips", "checkboxes", "multiselect"],
  boolean: ["toggle", "switcher"],
  range: ["range"],
};

export function isFilterUi(value: string): value is FilterUi {
  return (FILTER_UI_VALUES as readonly string[]).includes(value);
}

export function isFilterType(value: string): value is FilterType {
  return (FILTER_TYPE_VALUES as readonly string[]).includes(value);
}

export function isFilterPlacement(value: string): value is FilterPlacement {
  return (FILTER_PLACEMENT_VALUES as readonly string[]).includes(value);
}

export function isCompatibleTypeUi(type: FilterType, ui: FilterUi): boolean {
  return TYPE_UI_COMPATIBILITY[type]?.includes(ui) ?? false;
}

export function getCompatibleUis(type: FilterType): FilterUi[] {
  return TYPE_UI_COMPATIBILITY[type] ?? [];
}

export function getDefaultUiForType(type: FilterType): FilterUi {
  return TYPE_UI_COMPATIBILITY[type]?.[0] ?? "chips";
}
