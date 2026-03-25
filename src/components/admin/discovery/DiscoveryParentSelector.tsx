import { Label } from "@/components/ui/typography";
import { DISCOVERY_NATIVE_SELECT } from "./discoveryTaxonomyClasses";

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
      <select
        className={DISCOVERY_NATIVE_SELECT}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{emptyLabel}</option>
        {roots.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500">{helperText}</p>
    </div>
  );
}
