"use client";

import { cn } from "@/lib/utils";
import type { Intent } from "@/lib/intent";
import { filterConfigByIntent } from "@/lib/discovery/filterConfigByIntent";
import { useSecondaryFiltersFromUrl } from "@/features/filters/discovery/useSecondaryFiltersFromUrl";

type SecondaryFiltersFormProps = {
  intent: Intent;
  /** Компактные отступы (popover) */
  compact?: boolean;
  onApply?: () => void;
};

export function SecondaryFiltersForm({
  intent,
  compact = false,
  onApply,
}: SecondaryFiltersFormProps) {
  const groups = filterConfigByIntent[intent];
  const { values, patch, reset } = useSecondaryFiltersFromUrl(intent);

  if (!groups.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Для этого раздела пока нет дополнительных фильтров.
      </p>
    );
  }

  const gap = compact ? "space-y-5" : "space-y-8";

  const handleApply = () => {
    onApply?.();
  };

  return (
    <div className={cn(gap, "pb-1")}>
      {groups.map((group) => {
        if (group.kind === "boolean") {
          const on = values[group.id] === true;
          return (
            <div key={group.id} className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">{group.label}</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    patch({ [group.id]: e.target.checked ? true : undefined })
                  }
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 focus:ring-2"
                />
                <span className="text-sm text-gray-700">{group.trueLabel}</span>
              </label>
            </div>
          );
        }

        if (group.kind === "single") {
          const cur = typeof values[group.id] === "string" ? values[group.id] as string : null;
          return (
            <div key={group.id} className="space-y-2">
              <h3 className="text-sm font-medium text-gray-900">{group.label}</h3>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const active = cur === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        patch({ [group.id]: active ? undefined : opt.id })
                      }
                      className={cn(
                        "px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        const curList = Array.isArray(values[group.id])
          ? (values[group.id] as string[])
          : [];

        return (
          <div key={group.id} className="space-y-2">
            <h3 className="text-sm font-medium text-gray-900">{group.label}</h3>
            <div className="flex flex-wrap gap-2">
              {group.options.map((opt) => {
                const active = curList.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? curList.filter((id) => id !== opt.id)
                        : [...curList, opt.id];
                      patch({
                        [group.id]: next.length ? next : undefined,
                      });
                    }}
                    className={cn(
                      "px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-gray-900 text-white border-gray-900 shadow-md"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={() => {
            reset();
          }}
          className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors underline decoration-transparent hover:decoration-current underline-offset-2"
        >
          Сбросить
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Готово
        </button>
      </div>
    </div>
  );
}
