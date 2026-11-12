/**
 * The public Classes navigation is inventory-led, not taxonomy-led.
 * An active chip must correspond to at least one offer visible in the
 * city's unfiltered public Classes listing. Preserve admin ordering.
 */
export function filterPopulatedClassChips<T extends { slug: string; isActive: boolean }>(
  chips: readonly T[],
  hasPublishedClasses: boolean,
  populatedSlugs: ReadonlySet<string>,
): T[] {
  if (!hasPublishedClasses) return [];

  return chips.filter((chip) =>
    chip.isActive && (chip.slug === "all" || populatedSlugs.has(chip.slug)),
  );
}
