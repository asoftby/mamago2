"use client";

export type PlanPersonFilterOption = {
  value: string;
  label: string;
};

/**
 * Shared family filter for the My Plan page and its modal.
 * The shells may differ; labels, order, chip state and interaction must not.
 */
export function PlanPersonFilter({
  options,
  value,
  onChange,
  className = "",
}: {
  options: PlanPersonFilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Для кого"
      className={`flex w-full min-w-0 items-center gap-2 overflow-x-auto rounded-2xl border border-[rgba(20,18,16,.10)] bg-[#FAF7F1] px-3 py-3 [scrollbar-width:none] sm:px-4 ${className}`}
    >
      <span className="shrink-0 text-[13px] font-semibold text-[#6B6258]">Для кого:</span>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className="inline-flex min-h-11 max-w-[180px] shrink-0 items-center justify-center truncate rounded-full border px-4 text-[14px] font-semibold transition-colors"
            style={{
              color: selected ? "#fff" : "#141210",
              background: selected ? "#141210" : "#fff",
              borderColor: selected ? "#141210" : "rgba(20,18,16,.18)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function planPersonFilterOptions(
  people: readonly { value: string; label: string }[],
): PlanPersonFilterOption[] {
  return [
    ...people,
    { value: "all", label: "Для всех" },
  ];
}
