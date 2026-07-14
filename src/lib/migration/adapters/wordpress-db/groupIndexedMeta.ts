import type { MigrationWarning } from "../../types";

/**
 * One `<field>-location-<index>` group, e.g. `title-location-3` +
 * `description-location-3` + `images-location-3` all fold into
 * `{ index: 3, values: { title, description, images } }`. A field entirely
 * absent for that index is simply missing from `values` — never
 * synthesized as `null`/`""`.
 */
export interface IndexedMetaGroup {
  index: number;
  values: Partial<Record<string, string>>;
}

export interface GroupIndexedMetaResult {
  groups: readonly IndexedMetaGroup[];
  warnings: readonly MigrationWarning[];
}

/**
 * Generic pure helper for WordPress's repeated-postmeta-group convention
 * (confirmed live against real Route data, 2026-07-13:
 * `title-location-1..11`, `description-location-1..11`,
 * `images-location-1..11` on real published routes — see
 * docs/migration/wordpress-to-mamago.md "Routes" addendum). Not
 * Route-specific: any future WordPress importer with the same
 * `<field>-<group>-<index>` convention can reuse this by passing its own
 * `fields` list and `groupName`.
 *
 * `postMeta` is `WordPressPostMetaByKey` shape (values kept as an array to
 * preserve WP's own repeated-row behavior — see `groupPostMetaByKey` in
 * `WordPressRepository.ts`). Null/empty meta_value rows are already
 * filtered out by that grouping step before this helper ever sees them.
 */
export function groupIndexedMeta(
  postMeta: Readonly<Record<string, readonly string[]>>,
  fields: readonly string[],
  groupName: string,
): GroupIndexedMetaResult {
  const byIndex = new Map<number, Partial<Record<string, string>>>();
  const warnings: MigrationWarning[] = [];

  for (const [key, values] of Object.entries(postMeta)) {
    let matchedField: string | null = null;
    let indexPart: string | null = null;

    for (const field of fields) {
      const prefix = `${field}-${groupName}-`;
      const bare = `${field}-${groupName}`;
      if (key.startsWith(prefix)) {
        matchedField = field;
        indexPart = key.slice(prefix.length);
        break;
      }
      if (key === bare) {
        matchedField = field;
        indexPart = "";
        break;
      }
    }

    // Key doesn't recognize any known field prefix at all (e.g.
    // `rank_math_primary_route-budget`, `location`, `text`) — not this
    // helper's concern, silently ignored, no warning.
    if (matchedField === null || indexPart === null) continue;

    if (!/^\d+$/.test(indexPart)) {
      // Recognized field prefix but a missing/non-numeric index — real
      // data has this exact shape (a stray unsuffixed `title-location`
      // key duplicating an already-indexed stop's content on one real
      // route; see wordpress-to-mamago.md). Never guessed into a phantom
      // group — flagged and dropped instead.
      warnings.push({
        code: "ROUTE_META_KEY_UNPARSEABLE_INDEX",
        message: `Meta key "${key}" matches field "${matchedField}" but has no valid numeric index; excluded from grouping.`,
        severity: "WARNING",
        details: { key, field: matchedField },
      });
      continue;
    }

    if (values.length > 1) {
      warnings.push({
        code: "ROUTE_META_KEY_DUPLICATE",
        message: `Meta key "${key}" has ${values.length} values; using the first, others ignored.`,
        severity: "WARNING",
        details: { key, values },
      });
    }

    const index = Number(indexPart);
    const value = values[0];
    if (value === undefined || value.trim() === "") continue;

    const existing = byIndex.get(index) ?? {};
    existing[matchedField] = value;
    byIndex.set(index, existing);
  }

  const groups: IndexedMetaGroup[] = [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, values]) => ({ index, values }));

  return { groups, warnings };
}
