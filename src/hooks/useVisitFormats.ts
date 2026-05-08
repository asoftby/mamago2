/**
 * Hook for loading visit format options from admin taxonomy (SignalDefinition).
 *
 * Fetches the "format" group from DISCOVERY signals for the given entity type,
 * returning { label, value } pairs where value = slug (e.g. "format-indoor")
 * and label = Russian name from the taxonomy (e.g. "В помещении").
 *
 * Falls back to hardcoded Russian labels if the API is unavailable.
 */

import { useState, useEffect } from "react";

export type VisitFormatOption = {
  value: string; // slug, e.g. "format-indoor"
  label: string; // Russian label, e.g. "В помещении"
};

/** Stable fallback — only used if taxonomy API fails */
const FALLBACK_FORMATS: VisitFormatOption[] = [
  { value: "format-indoor", label: "В помещении" },
  { value: "format-outdoor", label: "На улице" },
  { value: "format-online", label: "Онлайн" },
];

/** Normalize legacy short slugs to full slugs */
export function normalizeVisitFormatSlug(value: string): string {
  const legacyMap: Record<string, string> = {
    indoor: "format-indoor",
    outdoor: "format-outdoor",
    online: "format-online",
  };
  return legacyMap[value] ?? value;
}

/** Normalize an array of visitFormats, migrating any legacy values */
export function normalizeVisitFormats(formats: string[]): string[] {
  return formats.map(normalizeVisitFormatSlug);
}

type EntityType = "PLACE" | "EVENT" | "ROUTE";

interface UseVisitFormatsResult {
  formats: VisitFormatOption[];
  isLoading: boolean;
}

export function useVisitFormats(entityType: EntityType = "PLACE"): UseVisitFormatsResult {
  const [formats, setFormats] = useState<VisitFormatOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/public/signals/discovery?entityType=${entityType}`
        );
        if (!res.ok) throw new Error("Failed to fetch signals");

        const json = await res.json();
        const groups: Array<{
          slug: string;
          options: Array<{ value: string; label: string; active: boolean }>;
        }> = json.groups ?? [];

        const formatGroup = groups.find((g) => g.slug === "format");
        if (formatGroup && formatGroup.options.length > 0) {
          const options = formatGroup.options
            .filter((o) => o.active)
            .map((o) => ({ value: o.value, label: o.label }));

          if (!cancelled && options.length > 0) {
            setFormats(options);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // fall through to fallback
      }

      if (!cancelled) {
        setFormats(FALLBACK_FORMATS);
        setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [entityType]);

  return { formats, isLoading };
}

/**
 * Get a Russian label for a visitFormat slug (or legacy value).
 * Works without the hook — useful for server-side or non-React contexts.
 */
export function getVisitFormatLabel(
  value: string,
  formats?: VisitFormatOption[]
): string {
  const normalized = normalizeVisitFormatSlug(value);
  const source = formats ?? FALLBACK_FORMATS;
  return source.find((f) => f.value === normalized)?.label ?? value;
}
