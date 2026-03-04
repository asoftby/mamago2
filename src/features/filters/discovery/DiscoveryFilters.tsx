"use client";

import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDiscoveryFilters, type DiscoveryFilters as DiscoveryFiltersType } from "./filters.store";
import { useDiscoveryFilterOptions } from "./filters.api";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { FilterFieldPill } from "@/components/discovery/FilterFieldPill";
import { MobileFilterSheet } from "@/components/discovery/MobileFilterSheet";
import { WhenSelect } from "@/components/ui/when-select";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { X, SlidersHorizontal } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Define Option type locally or import
type Option = { value: string; label: string };

type DiscoveryFiltersProps = {
  ageOptions?: Option[];
  metroOptions?: Option[];
  districtOptions?: Option[];
  forceUIMode?: "desktop" | "mobile";
  citySlug?: string;
  onChange?: () => void;
};

export function DiscoveryFilters({
  ageOptions: ageOptionsProp,
  metroOptions: metroOptionsProp,
  districtOptions: districtOptionsProp,
  forceUIMode,
  citySlug = "minsk",
  onChange,
}: DiscoveryFiltersProps) {
  const [mounted, setMounted] = useState(false);
  const isMobileQuery = useIsMobile();
  
  // Router hooks for immediate URL updates
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Fetch options from API if not provided via props
  const { options: apiOptions, loading: optionsLoading } = useDiscoveryFilterOptions(citySlug);
  
  // Use canonical AGE_GROUPS as the single source of truth for age options
  const canonicalAgeOptions = AGE_GROUPS.map(group => ({ 
    value: group.value, 
    label: group.label 
  }));
  
  // Use prop options if provided, otherwise use canonical mapping (age) or API (metro/district)
  const ageOptions = ageOptionsProp || canonicalAgeOptions;
  const metroOptions = metroOptionsProp || apiOptions.metros.map(o => ({ value: o.value, label: o.label }));
  const districtOptions = districtOptionsProp || apiOptions.districts.map(o => ({ value: o.value, label: o.label }));
  
  // Use forceUIMode if present, otherwise use media query (only after mount)
  const isMobile = forceUIMode 
    ? forceUIMode === "mobile" 
    : (mounted && isMobileQuery);

  const { 
    applied, 
    draft, 
    setDraft, 
    actions, 
    derived 
  } = useDiscoveryFilters();

  useEffect(() => {
    setMounted(true);
  }, []);

  const [sheetOpen, setSheetOpen] = useState(false);
  // Initialize draft from applied only when opening the sheet
  useEffect(() => {
    if (sheetOpen) {
      setDraft(applied);
    }
  }, [sheetOpen, applied, setDraft]);

  // Track if component has mounted to avoid calling onChange on initial render
  const didMountRef = useRef(false);
  
  // Trigger onChange callback when applied filters change
  useEffect(() => {
    // Skip the first render (initial mount)
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    
    // Call onChange when any filter value changes
    onChange?.();
  }, [applied.dateFrom, applied.dateTo, applied.whenPreset, applied.age, applied.metro, applied.district, onChange]);

  // Prepare "When" value for WhenSelect trigger/open state:
  // - If preset selected -> pass string ('today' | 'tomorrow' | 'weekend')
  // - Else if dates -> pass Date or {from,to}
  const whenValue = (() => {
    if (applied.whenPreset === "TODAY") return "today";
    if (applied.whenPreset === "TOMORROW") return "tomorrow";
    if (applied.whenPreset === "WEEKEND") return "weekend";
    if (!applied.dateFrom) return null;
    try {
      const fromDate = new Date(applied.dateFrom);
      if (isNaN(fromDate.getTime())) return null;
      if (applied.dateTo) {
        const toDate = new Date(applied.dateTo);
        if (isNaN(toDate.getTime())) return fromDate;
        return { from: fromDate, to: toDate };
      }
      return fromDate;
    } catch {
      return null;
    }
  })();
  
  // Helper function to update URL immediately (for desktop)
  const updateUrlImmediately = (patch: Partial<DiscoveryFiltersType>) => {
    const nextApplied = { ...applied, ...patch };
    const params = new URLSearchParams(searchParams.toString());
    
    // Date
    if (nextApplied.dateFrom) params.set("from", nextApplied.dateFrom); else params.delete("from");
    if (nextApplied.dateTo) params.set("to", nextApplied.dateTo); else params.delete("to");
    params.delete("when");
    params.delete("dateFrom");
    params.delete("dateTo");
    
    // When Preset
    if (nextApplied.whenPreset) params.set("preset", nextApplied.whenPreset); else params.delete("preset");
    
    // Age
    if (nextApplied.age.length > 0) params.set("age", nextApplied.age.join(",")); else params.delete("age");
    
    // Metro (now single value)
    if (nextApplied.metro) params.set("metro", nextApplied.metro); else params.delete("metro");
    
    // District
    if (nextApplied.district) params.set("district", nextApplied.district); else params.delete("district");
    
    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(url, { scroll: false });
  };
  
  // Handlers for Desktop (Immediate Apply)
  const handleWhenChangeDesktop = (val: any) => {
      let patch: Partial<DiscoveryFiltersType> = {};
      if (!val) {
          patch = { dateFrom: null, dateTo: null, whenPreset: null };
      } else if (typeof val === 'string') {
          // Handle preset strings like "today", "tomorrow", "weekend"
          if (val === 'today') {
              patch = { whenPreset: "TODAY", dateFrom: null, dateTo: null };
          } else if (val === 'tomorrow') {
              patch = { whenPreset: "TOMORROW", dateFrom: null, dateTo: null };
          } else if (val === 'weekend') {
              patch = { whenPreset: "WEEKEND", dateFrom: null, dateTo: null };
          } else {
              // Assume it's already a date string (YYYY-MM-DD)
              patch = { whenPreset: null, dateFrom: val, dateTo: null };
          }
      } else if (val instanceof Date) {
          patch = { whenPreset: null, dateFrom: val.toISOString().split('T')[0], dateTo: null };
      } else if ('from' in val) {
          patch = { 
              whenPreset: null,
              dateFrom: val.from.toISOString().split('T')[0], 
              dateTo: val.to.toISOString().split('T')[0] 
          };
      }
      updateUrlImmediately(patch);
  };

  const handleAgeChange = (values: string[]) => {
    updateUrlImmediately({ age: values });
  };

  const handleMetroChange = (value: string | null) => {
    updateUrlImmediately({ metro: value });
  };

  const handleDistrictChange = (value: string | null) => {
    updateUrlImmediately({ district: value });
  };

  if (isMobile) {
    // Mobile Trigger (Single button)
    const activeCount = derived.activeCount;

    return (
      <div className="flex items-center gap-3 pb-2 w-full">
        <FilterFieldPill 
          label="Фильтры"
          value={activeCount > 0 ? `${activeCount}` : "Выберите..."}
          selected={activeCount > 0}
          onClick={() => setSheetOpen(true)}
          className="flex-1"
          rightIcon={<SlidersHorizontal className="h-4 w-4 opacity-50" />}
        />
        
        {derived.isDirty && (
          <button
            onClick={actions.resetAll}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-background hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground shrink-0"
            title="Сбросить все"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <MobileFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          filters={{
             when: draft.whenPreset === "TODAY" ? "today"
               : draft.whenPreset === "TOMORROW" ? "tomorrow"
               : draft.whenPreset === "WEEKEND" ? "weekend"
               : (draft.dateFrom ? (draft.dateTo ? { from: new Date(draft.dateFrom), to: new Date(draft.dateTo) } : new Date(draft.dateFrom)) : null),
             age: draft.age,
             metro: draft.metro,
             district: draft.district,
             dateFrom: draft.dateFrom,
             dateTo: draft.dateTo,
             whenPreset: draft.whenPreset,
          }}
          draft={draft}
          setDraft={setDraft}
          onDone={() => {
              actions.apply();
              setSheetOpen(false);
          }}
          onReset={actions.resetAll}
          ageOptions={ageOptions}
          metroOptions={metroOptions}
          districtOptions={districtOptions}
        />
      </div>
    );
  }

  // DESKTOP - All filters use FilterFieldPill style
  return (
    <div className="w-full flex gap-3 items-center py-1">
      {derived.isDirty && (
          <button
            onClick={actions.resetAll}
            className="flex h-[40px] w-[40px] min-w-[40px] items-center justify-center rounded-full border bg-background hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground"
            title="Сбросить все фильтры"
          >
            <X className="h-5 w-5" />
          </button>
      )}
      
      {/* When Select - using default trigger (already matches FilterFieldPill style) */}
      <WhenSelect 
        className="flex-1 min-w-0" 
        value={whenValue} 
        onChange={handleWhenChangeDesktop}
        uiMode="desktop"
        label="Когда идём"
      />

      {/* Age Multi-Select - using manual apply mode with sticky footer */}
      <CardMultiSelect 
        label="Возраст"
        options={ageOptions} 
        values={applied.age} 
        onChange={handleAgeChange} 
        allowClear
        className="flex-1 min-w-0" 
        uiMode="desktop"
        variant="card"
        applyMode="manual"
        closeOnApply={true}
      />

      {/* Metro Select (SINGLE) - using default trigger (card variant matches FilterFieldPill) */}
      <CardSelect 
        label="Метро" 
        options={metroOptions} 
        value={applied.metro} 
        onChange={handleMetroChange} 
        allowClear
        className="flex-1 min-w-0" 
        uiMode="desktop"
        variant="card"
      />

      {/* District Select - using default trigger (card variant matches FilterFieldPill) */}
      <CardSelect 
        label="Район" 
        options={districtOptions} 
        value={applied.district} 
        onChange={handleDistrictChange} 
        allowClear
        className="flex-1 min-w-0" 
        uiMode="desktop"
        variant="card"
      />
    </div>
  );
}
