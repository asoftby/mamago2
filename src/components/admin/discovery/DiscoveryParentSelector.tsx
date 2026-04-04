import { Label } from "@/components/ui/typography";
import { FilterSelect } from "@/components/ui/filter-select";

export type DiscoveryParentRootOption = { id: string; label: string };

/**
 * Селектор родителя для двухуровневых сущностей (категории, сигналы).
 * Для плоских списков не рендерить.
 */
export function DiscoveryParentSelector({
  label,
  helperText,
  value,
  onChange,
  roots,
  emptyLabel,
}: {
  label: string;
  helperText: string;
  value: string | null;
  onChange: (next: string | null) => void;
  roots: DiscoveryParentRootOption[];
  emptyLabel: string;
}) {
  return (
    <div className="grid gap-2 max-w-md">
      <Label>{label}</Label>
      <FilterSelect
        value={value ?? ""}
        placeholder={emptyLabel}
        options={roots.map((r) => ({ value: r.id, label: r.label }))}
        onChange={(v) => onChange(v || null)}
      />
      <p className="text-xs text-gray-500">{helperText}</p>
    </div>
  );
}
