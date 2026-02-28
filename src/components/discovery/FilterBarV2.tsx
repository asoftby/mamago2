"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { INTENT_CONFIG, IntentType } from "@/server/discovery/intentConfig";

type FilterDefinition = {
  id: string;
  slug: string;
  title: string;
  type: string; // "single" | "multi"
  options: {
    value: string;
    label: string;
  }[];
  orderIndex: number;
};

type Option = {
  value: string;
  label: string;
};

interface FilterBarV2Props {
  intent: IntentType;
  citySlug: string;
  definitions: FilterDefinition[];
  metroOptions: Option[];
  districtOptions: Option[];
  variant?: "card" | "pill";
}

export function FilterBarV2({
  intent,
  citySlug,
  definitions,
  metroOptions,
  districtOptions,
  variant = "pill",
}: FilterBarV2Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Helper to update URL params
  const updateQuery = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Replace URL without scrolling and without reloading
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const allowedSlugs = INTENT_CONFIG[intent] || [];

  // Filter definitions relevant to current intent
  const visibleDefinitions = definitions
    .filter((def) => allowedSlugs.includes(def.slug))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Manual sorting to ensure 'when' comes first if present, then others by orderIndex
  // Or just rely on orderIndex from DB if managed correctly.
  // Let's assume orderIndex is correct.

  return (
    <div className="flex flex-wrap gap-3 w-full">
      {visibleDefinitions.map((def) => {
        const value = searchParams.get(def.slug);
        
        // Special handling for 'district' and 'metro' if they are not in DB definitions but passed as props
        // Wait, the requirement says "district from Geo directory".
        // If 'district' is in definitions (from DB), we use its options? 
        // Or do we override options for district/metro?
        // Let's assume district/metro might be in definitions for ordering/title, but options come from props.
        
        let options = def.options;
        if (def.slug === "district") options = districtOptions;
        if (def.slug === "metro") options = metroOptions;
        
        // If definition has no options and not special, skip?
        if (options.length === 0) return null;

        if (def.type === "multi" || def.slug === "age" || def.slug === "district" || def.slug === "metro") {
           // Treat age, district, metro as multi by default or if type is multi
           const selectedValues = value ? value.split(",") : [];
           
           return (
             <CardMultiSelect
               key={def.slug}
               variant={variant}
               label={def.title}
               placeholder={def.title}
               options={options}
               values={selectedValues}
               onChange={(vals) => updateQuery(def.slug, vals.length > 0 ? vals.join(",") : null)}
               allowClear
               className="w-auto"
             />
           );
        } else {
          // Single select (e.g. 'when')
          return (
            <CardSelect
              key={def.slug}
              variant={variant}
              label={def.title}
              placeholder={def.title}
              options={options}
              value={value}
              onChange={(val) => updateQuery(def.slug, val)}
              allowClear
              className="w-auto"
            />
          );
        }
      })}
    </div>
  );
}
