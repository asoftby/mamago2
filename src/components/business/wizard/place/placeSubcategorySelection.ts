/**
 * Pure array semantics for Place Step 1's subcategory selection.
 *
 * Storage contract (unchanged — matches `Place.subcategories` ordered by
 * `position` server-side, see mappers.ts): `subcategoryIds: string[]`,
 * where index 0 is always the PRIMARY subcategory and the rest are
 * ADDITIONAL subcategories. This module only changes how the UI builds and
 * edits that array — the array itself, its meaning, and how it's persisted
 * are untouched, so every existing Place keeps working with zero migration:
 * an existing `["museum", "gallery", "kids"]` is simply read back as
 * primary "museum" + additional ["gallery", "kids"].
 */

export const MAX_SUBCATEGORIES = 3;
export const MAX_ADDITIONAL_SUBCATEGORIES = MAX_SUBCATEGORIES - 1;

export interface SubcategorySelection {
  primary: string | null;
  additional: string[];
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Splits the stored array into `{ primary, additional }` for display.
 * Backward compatible with any existing Place, regardless of how the
 * record was created — index 0 is always primary.
 */
export function deriveSubcategorySelection(subcategoryIds: string[]): SubcategorySelection {
  const [primary, ...rest] = subcategoryIds;
  return {
    primary: primary ?? null,
    additional: dedupePreserveOrder(rest).slice(0, MAX_ADDITIONAL_SUBCATEGORIES),
  };
}

/**
 * Sets (or replaces) the primary subcategory.
 *
 * - `newPrimaryId === null` clears the whole selection (no primary implies
 *   no additional subcategories).
 * - Re-picking the CURRENT primary is a no-op — returns `current` by
 *   reference, unchanged.
 * - Picking a subcategory that was previously ADDITIONAL promotes it to
 *   primary; the previous primary rejoins as additional if there's room.
 * - Picking a subcategory that wasn't selected at all becomes the new
 *   primary; the previous primary rejoins as additional (first), followed
 *   by the previous additional entries in their original relative order,
 *   as far as the max-additional cap allows.
 *
 * Never produces duplicates; always caps at MAX_SUBCATEGORIES total.
 */
export function setPrimarySubcategory(
  current: string[],
  newPrimaryId: string | null,
): string[] {
  if (!newPrimaryId) return [];

  const oldPrimary = current[0] ?? null;
  if (oldPrimary === newPrimaryId) return current;

  const oldAdditional = current.slice(1).filter((id) => id !== newPrimaryId);
  const demoted = oldPrimary ? [oldPrimary, ...oldAdditional] : oldAdditional;
  const additional = dedupePreserveOrder(demoted)
    .filter((id) => id !== newPrimaryId)
    .slice(0, MAX_ADDITIONAL_SUBCATEGORIES);

  return [newPrimaryId, ...additional];
}

/**
 * Adds an additional (non-primary) subcategory. No-ops (returns `current`
 * by reference) if there's no primary yet, `id` is already selected
 * (whether as primary or additional), or the additional cap is already
 * reached.
 */
export function addAdditionalSubcategory(current: string[], id: string): string[] {
  const primary = current[0] ?? null;
  if (!primary) return current;
  if (current.includes(id)) return current;

  const additional = current.slice(1);
  if (additional.length >= MAX_ADDITIONAL_SUBCATEGORIES) return current;

  return [primary, ...additional, id];
}

/**
 * Removes an additional subcategory. No-ops (returns `current` by
 * reference) if `id` is the primary (use `setPrimarySubcategory` to change
 * the primary instead) or isn't currently selected.
 */
export function removeAdditionalSubcategory(current: string[], id: string): string[] {
  const primary = current[0] ?? null;
  if (!primary || id === primary) return current;
  const additional = current.slice(1);
  if (!additional.includes(id)) return current;
  return [primary, ...additional.filter((existing) => existing !== id)];
}

/**
 * Whether an "additional subcategory" chip should render disabled.
 *
 * `addAdditionalSubcategory()` is a no-op while there's no primary yet, so
 * every chip — not just unselected ones — is disabled until a primary is
 * set, rather than advertising an action that would silently do nothing.
 * This is provably safe for an already-selected chip too: `additional` is
 * `subcategoryIds.slice(1)`, so it can only be non-empty once
 * `subcategoryIds[0]` (primary) already exists — "selected but no primary"
 * is not a reachable state, so this never disables a chip a user actually
 * needs to remove.
 */
export function isAdditionalSubcategoryChipDisabled(params: {
  isEditable: boolean;
  isSelected: boolean;
  hasPrimary: boolean;
  additionalLimitReached: boolean;
}): boolean {
  return (
    !params.isEditable ||
    !params.hasPrimary ||
    (!params.isSelected && params.additionalLimitReached)
  );
}
