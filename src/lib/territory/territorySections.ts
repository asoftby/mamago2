import type { TerritoryType } from "@prisma/client";

/** Product sections that scope their content by the selected territory. */
export const TERRITORY_SECTIONS = ["journal", "kuda", "classes", "birthday"] as const;
export type TerritorySection = (typeof TERRITORY_SECTIONS)[number];

export const WHOLE_COUNTRY_SLUG = "belarus";
export const DEFAULT_CITY_TERRITORY_SLUG = "minsk";

export function isTerritorySection(value: string | null | undefined): value is TerritorySection {
  return !!value && (TERRITORY_SECTIONS as readonly string[]).includes(value);
}

/** The birthday section needs a concrete city: "whole country" is not supported there. */
export function isTerritoryTypeSupported(section: TerritorySection, type: TerritoryType): boolean {
  return !(section === "birthday" && type === "COUNTRY");
}

/** Journal opens on the whole country, every other section on the default city. */
export function defaultTerritorySlugForSection(section: TerritorySection): string {
  return section === "journal" ? WHOLE_COUNTRY_SLUG : DEFAULT_CITY_TERRITORY_SLUG;
}
