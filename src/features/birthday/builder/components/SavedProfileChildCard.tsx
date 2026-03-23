"use client";

import { cn } from "@/lib/utils";
import { getSystemInterestLabel } from "@/lib/config/interests";
import { ageYearsFromBirthDate, formatYearsRu } from "../lib/partyChildUtils";

/** Совпадает с формой /api/children */
export type SavedProfileChildRow = {
  id: string;
  name: string;
  birthDate: string;
  systemInterests?: { interestSlug: string }[];
};

function birthIsoFromApi(d: string): string {
  if (!d) return "";
  return d.slice(0, 10);
}

type SavedProfileChildCardProps = {
  child: SavedProfileChildRow;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
};

export function SavedProfileChildCard({
  child,
  selected,
  onSelect,
  onEdit,
}: SavedProfileChildCardProps) {
  const iso = birthIsoFromApi(child.birthDate);
  const years = ageYearsFromBirthDate(iso);
  const ageText = formatYearsRu(years);
  const slugs =
    child.systemInterests?.map((x) => x.interestSlug).filter(Boolean) ?? [];
  const interestsLine =
    slugs.length > 0
      ? `Интересы: ${slugs.map((s) => getSystemInterestLabel(s)).join(", ")}`
      : "Интересы: не указаны";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "w-full rounded-2xl border px-4 py-3 text-left transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-[#EF8759]/35 focus-visible:ring-offset-2",
        selected
          ? "border-[#EF8759] bg-[#FFF7F3]"
          : "border-zinc-200/90 bg-white hover:bg-zinc-50/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground leading-snug">
            {child.name.trim()}, {ageText}
          </p>
          <p className="text-xs text-muted-foreground leading-snug">
            {interestsLine}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={cn(
            "shrink-0 text-xs font-medium text-[#EF8759] underline-offset-2",
            "hover:text-[#d9733f] hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/30 rounded-sm",
          )}
        >
          Изменить данные
        </button>
      </div>
    </div>
  );
}
