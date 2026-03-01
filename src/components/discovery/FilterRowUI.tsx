"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useEffect } from "react";
import { WhenSelect } from "@/components/ui/when-select";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { X, SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileFilterSheet } from "./MobileFilterSheet";

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
  const [resetVersion, setResetVersion] = useState(0);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  const handleMultiSelectChange = (key: string, values: string[]) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (values.length === 0) {
        params.delete(key);
      } else {
        params.set(key, values.join(","));
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };
  
  const handleResetAll = () => {
    startTransition(() => {
        router.replace(pathname, { scroll: false });
        setResetVersion(v => v + 1);
    });
  };

  // Get current values from URL
  const whenValue = searchParams.get("when");
  let when: any = null;
  if (whenValue) {
      if (whenValue.includes(",")) {
          const [from, to] = whenValue.split(",");
          when = { from: new Date(from), to: new Date(to) };
      } else if (["today", "tomorrow", "weekend"].includes(whenValue)) {
          when = whenValue;
      } else {
          when = new Date(whenValue);
      }
  }

  const ageValue = searchParams.get("age")?.split(",").filter(Boolean) || [];
  // Assuming single value for metro and district now
  const metroValue = searchParams.get("metro");
  const districtValue = searchParams.get("district");

  const hasActiveFilters = !!(whenValue || ageValue.length > 0 || metroValue || districtValue);
  const activeCount = [whenValue ? 1 : 0, ageValue.length > 0 ? 1 : 0, metroValue ? 1 : 0, districtValue ? 1 : 0].reduce((a, b) => a + b, 0);

  if (isClient && isMobile) {
    return (
      <div className="flex items-center gap-3 pb-2 w-full">
        <button
          onClick={() => setSheetOpen(true)}
          className="relative flex items-center gap-2 px-5 py-3 rounded-full border bg-background hover:bg-muted/30 transition-all font-medium text-sm h-12 shadow-sm flex-1 justify-center"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-foreground">Фильтры</span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold ml-1">
              {activeCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleResetAll}
            className="flex h-12 w-12 items-center justify-center rounded-full border bg-background hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground shrink-0"
            title="Сбросить все"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <MobileFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          filters={{
            when,
            age: ageValue,
            metro: metroValue,
            district: districtValue
          }}
          onApply={(newFilters) => {
            const params = new URLSearchParams(searchParams.toString());

            // When
            if (!newFilters.when) params.delete("when");
            else {
              let v = "";
              if (typeof newFilters.when === 'string') v = newFilters.when;
              else if (newFilters.when instanceof Date) v = newFilters.when.toISOString();
              else if ('from' in newFilters.when) v = `${newFilters.when.from.toISOString()},${newFilters.when.to.toISOString()}`;
              params.set("when", v);
            }

            // Age
            if (newFilters.age.length === 0) params.delete("age");
            else params.set("age", newFilters.age.join(","));

            // Metro
            if (!newFilters.metro) params.delete("metro");
            else params.set("metro", newFilters.metro);

            // District
            if (!newFilters.district) params.delete("district");
            else params.set("district", newFilters.district);

            startTransition(() => {
              router.replace(`${pathname}?${params.toString()}`, { scroll: false });
            });
            // Don't close sheet here, as it's live update
          }}
          onReset={() => {
             handleResetAll();
             // Keep sheet open or close? Usually reset just clears values.
             // But handleResetAll updates router immediately.
             // If we want sheet to reflect reset, we should update local draft inside sheet?
             // Actually handleResetAll updates URL, which updates props to sheet, which updates draft via useEffect.
             // So it should work.
          }}
          ageOptions={ageOptions}
          metroOptions={metroOptions}
          districtOptions={districtOptions}
        />
      </div>
    );
  }

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
        key={resetVersion}
        className="min-w-[240px] w-auto" 
        value={when}
        onChange={(val) => {
           let v: string | null = null;
           if (typeof val === 'string') v = val;
           else if (val instanceof Date) v = val.toISOString();
           else if (val && 'from' in val) v = `${val.from.toISOString()},${val.to.toISOString()}`;
           handleFilterChange("when", v);
        }}
      />
      <CardMultiSelect 
        label="Возраст" 
        options={ageOptions} 
        values={ageValue} 
        onChange={(vals) => handleMultiSelectChange("age", vals)} 
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
