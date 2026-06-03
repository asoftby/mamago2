const DEFAULT_BIRTHDAY_BUILDER_CITY = "minsk";

export function getBirthdayBuilderHref(citySlug?: string | null): string {
  const normalizedCity = citySlug?.trim() || DEFAULT_BIRTHDAY_BUILDER_CITY;
  return `/${normalizedCity}/birthday/make`;
}

