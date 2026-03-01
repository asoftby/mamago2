import { FilterDef } from "../types";

export const minskActivitiesFilters: FilterDef[] = [
  {
    key: "age",
    label: "Возраст",
    mode: "multi",
    options: [
      { value: "0-1", label: "0-1 год" },
      { value: "1-3", label: "1-3 года" },
      { value: "3-5", label: "3-5 лет" },
      { value: "6-9", label: "6-9 лет" },
      { value: "10-14", label: "10-14 лет" },
    ],
    placeholder: "Возраст",
  },
  {
    key: "district",
    label: "Район",
    mode: "single",
    options: [
      { value: "center", label: "Центральный" },
      { value: "frunz", label: "Фрунзенский" },
      { value: "mosc", label: "Московский" },
      { value: "sov", label: "Советский" },
    ],
    placeholder: "Район",
  },
  {
    key: "metro",
    label: "Метро",
    mode: "single",
    options: [
      { value: "uruchie", label: "Уручье" },
      { value: "kamennaya", label: "Каменная Горка" },
      { value: "nemiga", label: "Немига" },
      { value: "oktyabrskaya", label: "Октябрьская" },
    ],
    placeholder: "Метро",
  },
];
