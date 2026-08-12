"use client";

import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useDiscoveryFilterOptions } from "@/features/filters/discovery/filters.api";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";

export function EventAdvancedFilters({ citySlug, onApply }: { citySlug: string; onApply?: () => void }) {
  const { applied, actions } = useDiscoveryFilters();
  const { options, loading } = useDiscoveryFilterOptions(citySlug);

  const toggleAge = (value: string) => {
    const age = applied.age.includes(value)
      ? applied.age.filter((item) => item !== value)
      : [...applied.age, value];
    actions.setDraft({ age });
  };

  return (
    <div className="space-y-6 pb-1">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Возраст</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((group) => (
            <button key={group.value} type="button" aria-pressed={applied.age.includes(group.value)} onClick={() => toggleAge(group.value)} className={applied.age.includes(group.value) ? "rounded-full bg-neutral-900 px-3 py-2 text-sm text-white" : "rounded-full border border-neutral-200 px-3 py-2 text-sm text-neutral-700"}>
              {group.label}
            </button>
          ))}
        </div>
      </fieldset>

      <FilterSelect label="Формат" value={applied.format ?? ""} onChange={(value) => actions.setDraft({ format: (value || null) as typeof applied.format })} options={[{ value: "OFFLINE", label: "Офлайн" }, { value: "ONLINE", label: "Онлайн" }, { value: "HYBRID", label: "Гибрид" }]} />
      <FilterSelect label="Район" value={applied.district ?? ""} onChange={(value) => actions.setDraft({ district: value || null })} options={options.districts} disabled={loading} />
      <FilterSelect label="Метро" value={applied.metro ?? ""} onChange={(value) => actions.setDraft({ metro: value || null })} options={options.metros} disabled={loading} />

      <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
        <button type="button" className="text-sm font-semibold text-neutral-600 underline underline-offset-2" onClick={() => actions.resetAll()}>Сбросить всё</button>
        <button type="button" className="rounded-lg bg-neutral-900 px-8 py-3 text-sm font-semibold text-white" onClick={onApply}>Готово</button>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-neutral-900">{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 disabled:opacity-50">
        <option value="">Не выбрано</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
