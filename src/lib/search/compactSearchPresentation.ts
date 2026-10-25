/**
 * Search-only address presentation. Do not modify persisted address data.
 * Remove country, region and redundant copies of the known city.
 */
export function formatSearchAddress(
  address: string | null | undefined,
  cityName: string | null | undefined,
): string | null {
  const city = cityName?.trim().replace(/^г\.\s*/i, "") ?? "";
  const source = address?.trim();
  if (!source) return city ? `г. ${city}` : null;

  const pieces = source.split(/,\s*/).map((part) => part.trim()).filter(Boolean);
  const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cityPattern = city ? new RegExp(`^(?:г\\.?\\s*)?${escapedCity}$`, "i") : null;
  const kept = pieces.filter((part) =>
    !/^(?:Беларусь|Белоруссия|Республика Беларусь|Belarus|Republic of Belarus)$/i.test(part) &&
    !/^(?:Минская|Брестская|Гродненская|Гомельская|Витебская|Могилёвская|Могилевская)\s+область$/i.test(part) &&
    !(cityPattern?.test(part))
  );
  const street = kept.join(", ").replace(/^,\s*|,\s*$/g, "").trim();
  if (!city) return street || null;
  return street ? `г. ${city}, ${street}` : `г. ${city}`;
}

/** Search snippets show the youngest selected age, never a category enumeration. */
export function formatSearchAgeFromTags(tags: string[] | null | undefined): string | null {
  const years = (tags ?? []).flatMap((tag) => {
    const match = tag.trim().match(/^(\d+)\s*(?:[-–]\s*\d+|\+)$/);
    return match ? [Number(match[1])] : [];
  });
  return years.length ? `${Math.min(...years)}+` : null;
}
