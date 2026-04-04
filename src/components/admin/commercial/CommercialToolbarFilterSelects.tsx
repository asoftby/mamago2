"use client";

import { useState } from "react";
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select";

export type CommercialToolbarFilterConfig = {
  placeholder: string;
  options: FilterSelectOption[];
};

/**
 * Два+ FilterSelect в тулбаре коммерческих списков.
 * Вынесено в client component: RSC не может передавать onChange в FilterSelect.
 */
export function CommercialToolbarFilterSelects({
  filters,
}: {
  filters: CommercialToolbarFilterConfig[];
}) {
  const [values, setValues] = useState<string[]>(() =>
    filters.map(() => ""),
  );

  return (
    <>
      {filters.map((f, i) => (
        <FilterSelect
          key={`${f.placeholder}-${i}`}
          value={values[i] ?? ""}
          placeholder={f.placeholder}
          className="h-10 w-full md:w-auto"
          options={f.options}
          onChange={(v) => {
            setValues((prev) => {
              const next = [...prev];
              next[i] = v;
              return next;
            });
          }}
        />
      ))}
    </>
  );
}
