/** Единый справочник роли взрослого и возрастной группы (User.familyRole / ageBandLabel). */

export const FAMILY_ROLE_OPTIONS = [
  { value: "MOM" as const, label: "Мама" },
  { value: "DAD" as const, label: "Папа" },
  { value: "GRANDMA" as const, label: "Бабушка" },
  { value: "GRANDPA" as const, label: "Дедушка" },
  { value: "ADULT" as const, label: "Взрослый" },
] as const;

export type FamilyRoleValue = (typeof FAMILY_ROLE_OPTIONS)[number]["value"];

export const ADULT_AGE_BANDS = ["18–24", "25–34", "35–44", "45–54", "55+"] as const;

export type AdultAgeBandLabel = (typeof ADULT_AGE_BANDS)[number];
