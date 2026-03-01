import { FilterDef } from '../types';

export function getFilterSummary(def: FilterDef, value: string | string[] | null): string {
  // If empty, return label/placeholder
  if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return def.placeholder || def.label;
  }

  if (def.mode === 'single') {
    const val = value as string;
    const opt = def.options.find(o => o.value === val);
    return opt ? opt.label : val;
  } else {
    // multi
    const vals = value as string[];
    // Find labels for all selected values
    const labels = vals.map(v => {
      const opt = def.options.find(o => o.value === v);
      return opt ? opt.label : v;
    });

    if (vals.length <= 1) {
      return labels[0];
    }
    
    // For 2 or more, maybe show "Label + N" or just "N selected"?
    // Requirement says: "N выбрано" or joined labels up to 2, then "+N"
    // Let's do: "Label1, Label2" or "Label1 + 2"
    if (vals.length === 2) {
      return labels.join(', ');
    }
    
    // > 2
    return `${labels[0]} +${vals.length - 1}`;
  }
}
