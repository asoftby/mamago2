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
  const hide = (id: string) => {
    if ((!onExclusionsChange && !onAudienceChange) || !multi || id === "all") return;
    applyAudience(
      include.filter((item) => item !== id),
      exclude.includes(id) ? exclude.filter((item) => item !== id) : [...exclude, id],
    );
  };
  return (
    <div className={`w-full min-w-0 rounded-2xl border border-[rgba(20,18,16,.10)] bg-[#FAF7F1] px-3 py-3 sm:px-4 ${className}`}>
      <div role="group" aria-label="Для кого" className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <span className="shrink-0 text-[13px] font-semibold text-[#6B6258]">Для кого:</span>
        {options.map((option) => {
          const selected = multi ? (option.value === "all" ? include.length === 0 && exclude.length === 0 : include.includes(option.value)) : value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
              className="inline-flex min-h-11 max-w-[180px] shrink-0 items-center justify-center gap-1.5 truncate rounded-full border px-4 text-[14px] font-semibold transition-colors"
              style={{
                color: selected ? "#fff" : "#141210",
                background: selected ? "#141210" : "#fff",
                borderColor: selected ? "#141210" : "rgba(20,18,16,.18)",
              }}
            >
              {option.value !== "all" ? (option.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
              ) : (
                <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold">{option.label.trim().charAt(0).toUpperCase() || "•"}</span>
              )) : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {multi && (onExclusionsChange || onAudienceChange) && options.some((option) => option.value !== "all") && (
        <div role="group" aria-label="Исключить из плана" className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#6B6258]">Исключить:</span>
          {options.filter((option) => option.value !== "all").map((option) => (
            <button key={option.value} type="button" aria-pressed={exclude.includes(option.value)}
              onClick={() => hide(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs ${exclude.includes(option.value) ? "border-[#141210] bg-[#141210] text-white" : "border-black/15"}`}>
              {option.label}
            </button>
          ))}
        </div>
      )}
      {onVisibilityChange && (
        <div role="group" aria-label="Доступность дел" className="mt-3 flex flex-wrap items-center gap-2">
          {([{ id: "ALL", text: "Все доступные" }, { id: "PRIVATE", text: "Мои личные" }, { id: "FAMILY", text: "Общие" }] as const).map((option) => (
            <button key={option.id} type="button" aria-pressed={visibility === option.id}
              className={`rounded-full px-3 py-2 text-xs font-medium ${visibility === option.id ? "bg-[#141210] text-white" : "bg-white text-[#141210]"}`}
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
  return [...people, { value: "all", label: "Для всех" }];
}
