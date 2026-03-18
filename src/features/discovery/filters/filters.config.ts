/* eslint-disable @typescript-eslint/no-explicit-any */
type FilterType = "single" | "multi" | "dateRange";

type FilterConfig = {
  key: "when" | "age" | "districtId" | "metroId" | "dateRange";
  label: string;
  shortLabel?: string;
  type: FilterType;
  ui: {
    desktop: "popover" | "select" | "date";
    mobile: "sheet";
  };
  options?: Array<{ value: string; label: string }>;
  defaults?: any;
};

export const DISCOVERY_FILTERS_CONFIG: FilterConfig[] = [
  {
    key: "when",
    label: "Когда",
    shortLabel: "Когда",
    type: "dateRange",
    ui: { desktop: "date", mobile: "sheet" },
    options: [
      { value: "today", label: "Сегодня" },
      { value: "tomorrow", label: "Завтра" },
      { value: "weekend", label: "Выходные" },
    ],
    defaults: null,
  },
  {
    key: "age",
    label: "Возраст",
    shortLabel: "Возраст",
    type: "multi",
    ui: { desktop: "select", mobile: "sheet" },
    options: [
      { value: "0-1", label: "0-1 год" },
      { value: "1-3", label: "1-3 года" },
      { value: "3-5", label: "3-5 лет" },
      { value: "6-9", label: "6-9 лет" },
    ],
    defaults: [],
  },
  {
    key: "districtId",
    label: "Район",
    shortLabel: "Район",
    type: "single",
    ui: { desktop: "select", mobile: "sheet" },
    options: [],
    defaults: null,
  },
  {
    key: "metroId",
    label: "Метро",
    shortLabel: "Метро",
    type: "single",
    ui: { desktop: "select", mobile: "sheet" },
    options: [],
    defaults: null,
  },
];
