"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type OccasionOption = {
  id: string;
  name: string;
  slug: string;
  boostScore: number;
};

interface OccasionPickerProps {
  /** Currently selected occasion IDs */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Hide occasions that do not apply to the current editor surface. */
  excludeSlugs?: readonly string[];
}

/** Максимум выбранных поводов на событие */
const MAX_SELECTED_OCCASIONS = 2;
const EMPTY_EXCLUDED_SLUGS: readonly string[] = [];

/**
 * Compact pill-chip selector for currently active occasions.
 * Renders nothing if there are no active occasions.
 * Selection is optional — not a required field. 0..2 occasions.
 */
export function OccasionPicker({
  value,
  onChange,
  disabled,
  excludeSlugs = EMPTY_EXCLUDED_SLUGS,
}: OccasionPickerProps) {
  const [occasions, setOccasions] = useState<OccasionOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/occasions/active", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          const excluded = new Set(excludeSlugs);
          setOccasions(
            (data as OccasionOption[]).filter((occasion) => !excluded.has(occasion.slug)),
          );
        }
      })
      .catch(() => {
        // Graceful degradation — hide the block on error
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [excludeSlugs]);

  // Don't render anything while loading or if no active occasions
  if (loading || occasions.length === 0) return null;

  const limitReached = value.length >= MAX_SELECTED_OCCASIONS;

  const toggle = (id: string) => {
    if (disabled) return;
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
      return;
    }
    if (limitReached) return;
    onChange([...value, id]);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Актуальные поводы</p>
      <div className="flex flex-wrap gap-2">
        {occasions.map((o) => {
          const selected = value.includes(o.id);
          const chipDisabled = disabled || (!selected && limitReached);
          return (
            <button
              key={o.id}
              type="button"
              disabled={chipDisabled}
              onClick={() => toggle(o.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
                chipDisabled && "cursor-not-allowed opacity-50",
              )}
            >
              {o.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400">
        Необязательно, до {MAX_SELECTED_OCCASIONS} поводов. Повод помогает редактору и влияет на ранжирование в период актуальности.
      </p>
    </div>
  );
}
