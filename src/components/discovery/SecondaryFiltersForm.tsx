"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Intent } from "@/lib/intent";
import type { SecondaryFilterGroup } from "@/lib/discovery/filterConfigByIntent";
import { useSecondaryFiltersFromUrl } from "@/features/filters/discovery/useSecondaryFiltersFromUrl";
import { BudgetSliderFilter } from "@/components/discovery/BudgetSliderFilter";
import { useBudgetFilter } from "@/features/filters/discovery/useBudgetFilter";
import { useOptionalDiscoveryBudgetConfig } from "@/features/filters/discovery/discoveryBudgetContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";

type SecondaryFiltersFormProps = {
  intent: Intent;
  compact?: boolean;
  onApply?: () => void;
};

export function SecondaryFiltersForm({
  intent,
  compact = false,
  onApply,
}: SecondaryFiltersFormProps) {
  const [groups, setGroups] = useState<SecondaryFilterGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/discovery-filters?intent=${intent}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SecondaryFilterGroup[] | null) => {
        if (!cancelled && Array.isArray(data)) {
          setGroups(data);
        }
      })
      .catch(() => {/* fail closed: unsupported controls must not look functional */});
    return () => { cancelled = true; };
  }, [intent]);

  const { values, patch, reset } = useSecondaryFiltersFromUrl(intent);
  const primaryFilters = useDiscoveryFilters();
  const budgetCtx = useOptionalDiscoveryBudgetConfig();
  const budgetConfig = budgetCtx?.budgetConfig ?? null;
  const { clearBudget } = useBudgetFilter();

  if (!groups.length && !budgetConfig) {
    return (
      <p className="text-sm text-muted-foreground">
        Для этого раздела пока нет дополнительных фильтров.
      </p>
    );
  }

  const gap = compact ? "space-y-5" : "space-y-8";
  const handleReset = () => {
    reset();
    primaryFilters.actions.setDraft({ adultOnly: false });
    if (budgetConfig) clearBudget();
  };

  return (
    <div className={cn(gap, "pb-1")}>
      {budgetConfig ? <BudgetSliderFilter max={budgetConfig.max} /> : null}

      {groups.map((group) => (
        <FilterGroupRenderer
          key={group.id}
          group={group}
          values={group.id === "adult_only" ? { ...values, adult_only: primaryFilters.applied.adultOnly } : values}
          patch={group.id === "adult_only"
            ? (partial) => primaryFilters.actions.setDraft({ adultOnly: partial.adult_only === true })
            : patch}
        />
      ))}

      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={handleReset}
          className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors underline decoration-transparent hover:decoration-current underline-offset-2"
        >
          Сбросить
        </button>
        <button
          type="button"
          onClick={onApply}
          className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Готово
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components per UI type
// ---------------------------------------------------------------------------

type PatchFn = (partial: Partial<Record<string, string | string[] | boolean | undefined>>) => void;

/** Renders the group title when showTitle is true (default) */
function GroupTitle({ group }: { group: SecondaryFilterGroup }) {
  if (group.showTitle === false) return null;
  return <h3 className="text-sm font-medium text-gray-900">{group.label}</h3>;
}

/** Wrapper spacing: tighter when no title is shown */
function groupClass(group: SecondaryFilterGroup) {
  return group.showTitle === false ? "flex flex-col" : "space-y-2";
}

function FilterGroupRenderer({
  group,
  values,
  patch,
}: {
  group: SecondaryFilterGroup;
  values: Record<string, string | string[] | boolean>;
  patch: PatchFn;
}) {
  const ui = group.ui;

  if (group.kind === "boolean") {
    const on = values[group.id] === true;
    if (ui === "switcher") {
      return (
        <div className={groupClass(group)}>
          <GroupTitle group={group} />
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span className="text-sm text-gray-700">{group.trueLabel}</span>
            <button
              role="switch"
              aria-checked={on}
              type="button"
              onClick={() => patch({ [group.id]: on ? undefined : true })}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2",
                on ? "bg-gray-900" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200",
                  on ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </label>
        </div>
      );
    }
    // toggle / default for boolean
    return (
      <div className={groupClass(group)}>
        <GroupTitle group={group} />
        <button
          type="button"
          onClick={() => patch({ [group.id]: on ? undefined : true })}
          className={cn(
            "px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 self-start",
            on
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400",
          )}
        >
          {group.trueLabel}
        </button>
      </div>
    );
  }

  if (group.kind === "single") {
    const cur = typeof values[group.id] === "string" ? (values[group.id] as string) : null;

    if (ui === "tabs") {
      return (
        <div className={groupClass(group)}>
          <GroupTitle group={group} />
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {group.options.map((opt) => {
              const active = cur === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patch({ [group.id]: active ? undefined : opt.id })}
                  className={cn(
                    "flex-1 px-3 py-2 text-sm font-medium transition-all duration-200 border-r border-gray-200 last:border-r-0",
                    active ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
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

    if (ui === "select") {
      return (
        <div className={groupClass(group)}>
          <GroupTitle group={group} />
          <select
            value={cur ?? ""}
            onChange={(e) =>
              patch({ [group.id]: e.target.value || undefined })
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">— Любой —</option>
            {group.options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // chips / default for single
    return (
      <div className={groupClass(group)}>
        <GroupTitle group={group} />
        <div className="flex flex-wrap gap-2">
          {group.options.map((opt) => {
            const active = cur === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ [group.id]: active ? undefined : opt.id })}
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

  // kind === "multiple"
  const curList = Array.isArray(values[group.id]) ? (values[group.id] as string[]) : [];

  if (ui === "checkboxes") {
    return (
      <div className={groupClass(group)}>
        <GroupTitle group={group} />
        <div className="space-y-2">
          {group.options.map((opt) => {
            const active = curList.includes(opt.id);
            return (
              <label key={opt.id} className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => {
                    const next = active
                      ? curList.filter((id) => id !== opt.id)
                      : [...curList, opt.id];
                    patch({ [group.id]: next.length ? next : undefined });
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 focus:ring-2"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (ui === "multiselect") {
    return (
      <div className={groupClass(group)}>
        <GroupTitle group={group} />
        <select
          multiple
          value={curList}
          onChange={(e) => {
            const next = Array.from(e.target.selectedOptions).map((o) => o.value);
            patch({ [group.id]: next.length ? next : undefined });
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-[6rem]"
        >
          {group.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">Удерживайте Ctrl/⌘ для выбора нескольких</p>
      </div>
    );
  }

  // chips / default for multiple
  return (
    <div className={groupClass(group)}>
      <GroupTitle group={group} />
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
                patch({ [group.id]: next.length ? next : undefined });
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
}
