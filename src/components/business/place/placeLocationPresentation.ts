/**
 * Pure presentation helpers for Step 2's district/metro fields.
 *
 * This module only decides what COPY/UI-state a field should show — it
 * never reads or writes any of the correctness state machinery in
 * `placeLocationGeoOverrides.ts` (manual/auto invalidation, request
 * sequencing, distance calculation). Keeping that decision out of JSX is
 * what stops PlaceLocationPicker's render from turning into a large
 * ternary tree as more field states get added.
 */

export type GeoFieldMode = "manual" | "auto" | "unmatched" | "unavailable";

export interface GeoFieldPresentation {
  mode: GeoFieldMode;
  /** Status line shown under the field (e.g. "Изменено вручную"). */
  statusCopy: string;
  /** Label for the reset/clear action, or null when no action should show. */
  resetLabel: string | null;
}

/**
 * Decides a district/metro field's presentation from its manual/auto ids
 * and whether the reference list (districts, metro stations) loaded any
 * options at all for the current city.
 *
 * - `manual` set → "Изменено вручную", with a reset action. The action
 *   reads "Вернуть автоматически" when an auto value exists to fall back
 *   to, or "Очистить выбор" when it doesn't (there's nothing to "return"
 *   to).
 * - No manual, `auto` set → "Определено автоматически", no action (the
 *   field IS the source of truth — no separate card duplicates this).
 * - No manual, no auto, but the reference list has entries → user can pick
 *   one themselves; explains that automatic detection didn't find a match.
 * - No manual, no auto, and the reference list is empty/failed to load →
 *   caller-supplied human copy (district vs. metro need different nouns,
 *   so this stays a parameter rather than baked into the helper).
 */
export function getGeoFieldPresentation(params: {
  manualId: string | null;
  autoId: string | null;
  optionsAvailable: boolean;
  unavailableCopy: string;
}): GeoFieldPresentation {
  const { manualId, autoId, optionsAvailable, unavailableCopy } = params;

  if (manualId) {
    return {
      mode: "manual",
      statusCopy: "Изменено вручную",
      resetLabel: autoId ? "Вернуть автоматически" : "Очистить выбор",
    };
  }

  if (autoId) {
    return {
      mode: "auto",
      statusCopy: "Определено автоматически",
      resetLabel: null,
    };
  }

  if (optionsAvailable) {
    return {
      mode: "unmatched",
      statusCopy: "Не удалось определить автоматически — выберите при необходимости",
      resetLabel: null,
    };
  }

  return {
    mode: "unavailable",
    statusCopy: unavailableCopy,
    resetLabel: null,
  };
}
