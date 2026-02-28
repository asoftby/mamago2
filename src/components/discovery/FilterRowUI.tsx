"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { WhenSelect } from "@/components/ui/when-select";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { X } from "lucide-react";

type Option = { value: string; label: string };

type FilterRowUIProps = {
  ageOptions?: Option[];
  metroOptions?: Option[];
  districtOptions?: Option[];
};

export function FilterRowUI({
  ageOptions = [],
  metroOptions = [],
  districtOptions = [],
}: FilterRowUIProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const createQueryString = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (key: string, value: string | null) => {
    startTransition(() => {
      router.replace(`${pathname}?${createQueryString(key, value)}`, { scroll: false });
    });
  };
  
  const handleResetAll = () => {
    startTransition(() => {
        router.replace(pathname, { scroll: false });
    });
  };

  // Get current values from URL
  const whenValue = searchParams.get("when");
  const when = whenValue === "today" || whenValue === "tomorrow" || whenValue === "weekend" 
    ? whenValue 
    : whenValue ? new Date(whenValue) : null;

  const ageValue = searchParams.get("age");
  // Assuming single value for metro and district now
  const metroValue = searchParams.get("metro");
  const districtValue = searchParams.get("district");

  const hasActiveFilters = !!(whenValue || ageValue || metroValue || districtValue);

  return (
    <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-x-[20px] pb-2 items-center">
      {hasActiveFilters && (
          <button
            onClick={handleResetAll}
            className="flex h-[56px] w-[56px] min-w-[56px] items-center justify-center rounded-full border bg-background hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground"
            title="Сбросить все фильтры"
          >
            <X className="h-5 w-5" />
          </button>
      )}
      
      <WhenSelect 
        className="min-w-[240px] w-auto" 
        value={when}
        onChange={(val) => {
           let v: string | null = null;
           if (typeof val === 'string') v = val;
           else if (val instanceof Date) v = val.toISOString();
           else if (val && 'from' in val) v = null; 
           handleFilterChange("when", v);
        }}
      />
      <CardSelect 
        label="Возраст" 
        options={ageOptions} 
        value={ageValue} 
        onChange={(val) => handleFilterChange("age", val)} 
        allowClear
        className="min-w-[200px] w-auto" 
      />
      <CardSelect 
        label="Метро" 
        options={metroOptions} 
        value={metroValue} 
        onChange={(val) => handleFilterChange("metro", val)} 
        allowClear
        className="min-w-[200px] w-auto" 
      />
      <CardSelect 
        label="Район" 
        options={districtOptions} 
        value={districtValue} 
        onChange={(val) => handleFilterChange("district", val)} 
        allowClear
        className="min-w-[200px] w-auto" 
      />
    </div>
  );
}
