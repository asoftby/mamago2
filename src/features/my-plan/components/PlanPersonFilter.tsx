"use client";

export type PlanPersonFilterOption = {
  value: string;
  label: string;
  avatarUrl?: string | null;
};

/**
 * Shared participant filter. The old single selection interface remains usable
 * during gradual migration of the page and the widget. Neither mode grants
 * server access to additional PRIVATE/FAMILY plan records.
 */
export function PlanPersonFilter({
  options,
  value,
  onChange,
  selectedValues,
  onSelectionChange,
  onAudienceChange,
  excludedValues = [],
  onExclusionsChange,
  visibility = "ALL",
  onVisibilityChange,
  className = "",
}: {
  options: PlanPersonFilterOption[];
  value?: string;
  onChange?: (value: string) => void;
  selectedValues?: readonly string[];
  onSelectionChange?: (values: string[]) => void;
  /** Atomically replace include and exclude so a reset never restores stale values. */
  onAudienceChange?: (next: { include: string[]; exclude: string[] }) => void;
  excludedValues?: readonly string[];
  onExclusionsChange?: (values: string[]) => void;
  visibility?: "ALL" | "PRIVATE" | "FAMILY";
  onVisibilityChange?: (visibility: "ALL" | "PRIVATE" | "FAMILY") => void;
  className?: string;
}) {
  const multi = selectedValues !== undefined && (onSelectionChange !== undefined || onAudienceChange !== undefined);
  const include = selectedValues ?? [];
  const exclude = excludedValues;
  const applyAudience = (nextInclude: string[], nextExclude: string[]) => {
    if (onAudienceChange) {
      onAudienceChange({ include: nextInclude, exclude: nextExclude });
    } else {
      // Preserve older single-callback consumers during the rollout.
      onSelectionChange?.(nextInclude);
      onExclusionsChange?.(nextExclude);
    }
  };
  const toggle = (id: string) => {
    if (!multi) {
      onChange?.(id);
      return;
    }
    if (id === "all") {
      applyAudience([], []);
      return;
    }
    applyAudience(
      include.includes(id) ? include.filter((item) => item !== id) : [...include, id],
      exclude.filter((item) => item !== id),
    );
  };
  return (
    <div className={`w-full min-w-0 px-0 py-2 ${className}`}>
      <div role="group" aria-label="Для кого" className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        {options.map((option) => {
          const selected = multi ? (option.value === "all" ? include.length === 0 && exclude.length === 0 : include.includes(option.value)) : value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
              className="inline-flex h-[46px] max-w-[180px] shrink-0 items-center justify-center gap-2 truncate rounded-full border px-[18px] text-[14px] font-semibold transition-colors hover:border-[#6f675e]"
              style={{
                color: selected ? "#fff" : "#141210",
                background: selected ? "#141210" : "#fff",
                borderColor: selected ? "#141210" : "rgba(20,18,16,.18)",
              }}
            >
              {option.value !== "all" ? (option.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.avatarUrl} alt="" className="h-[26px] w-[26px] shrink-0 rounded-full object-cover" />
              ) : (
                <span aria-hidden className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: selected ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.1)" }}>{option.label.trim().charAt(0).toUpperCase() || "•"}</span>
              )) : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {onVisibilityChange && (
        <div role="group" aria-label="Доступность дел" className="mt-3 grid w-full grid-cols-3 items-end border-b border-black/10">
          {([{ id: "ALL", text: "Все доступные" }, { id: "PRIVATE", text: "Мои личные" }, { id: "FAMILY", text: "Общие" }] as const).map((option) => (
            <button key={option.id} type="button" aria-pressed={visibility === option.id}
              className={`min-w-0 border-b-2 px-1 py-3 text-center text-xs sm:text-sm transition-colors ${visibility === option.id ? "border-[#141210] font-semibold text-[#141210]" : "border-transparent font-normal text-[#6B6258]"}`}
              onClick={() => onVisibilityChange(option.id)}>{option.text}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function planPersonFilterOptions(
  people: readonly PlanPersonFilterOption[],
): PlanPersonFilterOption[] {
  return [{ value: "all", label: "Для всех" }, ...people.filter((person) => person.value !== "all")];
}
