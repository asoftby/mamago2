import type { SeoGeoSelectorOption } from "./types";

export const SEO_GEO_EMPTY_VALUE = "geo:none";
export const SEO_GEO_ALL_CITIES_VALUE = "geo:all-cities";

export type SeoGeoSelectorModel = {
  cityValue: string;
  regionValue: string;
  countryValue: string;
  cities: Extract<SeoGeoSelectorOption, { group: "city" }>[];
};

/**
 * Derive every selector from one canonical geo token. This prevents a city and
 * an unrelated region from ever co-existing as independent client state.
 */
export function buildSeoGeoSelectorModel(
  token: string,
  options: SeoGeoSelectorOption[],
): SeoGeoSelectorModel {
  const cities = options.filter(
    (option): option is Extract<SeoGeoSelectorOption, { group: "city" }> =>
      option.group === "city",
  );
  const selectedCity = cities.find((option) => option.value === token);
  const selectedRegion = options.find(
    (option): option is Extract<SeoGeoSelectorOption, { group: "region" }> =>
      option.group === "region" && option.value === token,
  );
  const selectedCountry = options.find(
    (option): option is Extract<SeoGeoSelectorOption, { group: "country" }> =>
      option.group === "country" && option.value === token,
  );

  const regionId = selectedCity?.regionId ?? selectedRegion?.regionId ?? null;
  const countryId =
    selectedCity?.countryId ??
    selectedRegion?.countryId ??
    selectedCountry?.countryId ??
    null;

  return {
    cityValue: selectedCity?.value ?? (selectedRegion ? SEO_GEO_ALL_CITIES_VALUE : SEO_GEO_EMPTY_VALUE),
    regionValue: regionId ? `region:${regionId}` : SEO_GEO_EMPTY_VALUE,
    countryValue: countryId ? `country:${countryId}` : SEO_GEO_EMPTY_VALUE,
    cities: regionId ? cities.filter((city) => city.regionId === regionId) : cities,
  };
}
