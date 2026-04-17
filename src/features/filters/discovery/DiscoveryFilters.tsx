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

  const { applied, setDraft, actions, derived } = useDiscoveryFilters();

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const [sheetOpen, setSheetOpen] = useState(false);

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

  // --- Mobile Pill Label & Value Computation ---
  const MONTHS_RU = ["янв.", "фев.", "мар.", "апр.", "май", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."];
  
  const fmtShortRu = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const month = MONTHS_RU[d.getMonth()];
      return `${day} ${month}`;
    } catch {
      return dateStr;
    }
  };
  
  const buildWhenLabel = (): string | null => {
    if (applied.whenPreset === "TODAY") return "Сегодня";
    if (applied.whenPreset === "TOMORROW") return "Завтра";
    if (applied.whenPreset === "WEEKEND") return "На выходных";
    
    if (!applied.dateFrom) return null;
    
    if (applied.dateTo && applied.dateFrom !== applied.dateTo) {
      // Range
      try {
        const from = new Date(applied.dateFrom);
        const to = new Date(applied.dateTo);
        const fromDay = from.getDate();
        const toDay = to.getDate();
        const fromMonth = from.getMonth();
        const toMonth = to.getMonth();
        const fromYear = from.getFullYear();
        const toYear = to.getFullYear();
        
        if (fromYear === toYear && fromMonth === toMonth) {
          // Same month: "5–9 мар."
          return `${fromDay}–${toDay} ${MONTHS_RU[fromMonth]}`;
        } else {
          // Different months: "5 мар.–15 апр."
          return `${fmtShortRu(applied.dateFrom)}–${fmtShortRu(applied.dateTo)}`;
        }
      } catch {
        return fmtShortRu(applied.dateFrom);
      }
    }
    
    // Single date
    return fmtShortRu(applied.dateFrom);
  };
  
  // Check if any other category besides age is active
  const whenActive = !!(applied.whenPreset || applied.dateFrom);
  const ageActive = (applied.age?.length ?? 0) > 0;
  const metroActive = !!applied.metro;
  const districtActive = !!applied.district;
  
  const otherCategoriesActive = whenActive || metroActive || districtActive;
  
  const buildAgeLabel = (): string | null => {
    if (applied.age.length === 0) return null;
    
    // Resolve age labels
    const ageLabels = applied.age
      .map(ageValue => {
        const option = ageOptions.find(opt => opt.value === ageValue);
        return option ? option.label : ageValue;
      });
    
    if (otherCategoriesActive) {
      // Age + other categories: show first age + count
      // "9–12 лет +1" if 2 ages, "9–12 лет +2" if 3 ages
      if (ageLabels.length === 1) {
        return ageLabels[0];
      }
      return `${ageLabels[0]} +${ageLabels.length - 1}`;
    } else {
      // ONLY age is active: show up to 2 labels
      if (ageLabels.length === 1) {
        return ageLabels[0];
      } else if (ageLabels.length === 2) {
        return `${ageLabels[0]}, ${ageLabels[1]}`;
      } else {
        // 3+ ages: show first two + count
        return `${ageLabels[0]}, ${ageLabels[1]} +${ageLabels.length - 2}`;
      }
    }
  };
  
  const resolveOptionLabel = (options: Option[], value: string | null): string | null => {
    if (!value) return null;
    const option = options.find(opt => opt.value === value);
    return option ? option.label : value;
  };
  
  // Build category labels
  const whenLabel = buildWhenLabel();
  const ageLabel = buildAgeLabel();
  const metroLabel = resolveOptionLabel(metroOptions, applied.metro);
  const districtLabel = resolveOptionLabel(districtOptions, applied.district);
  
  // Build ordered list of active categories (stable priority)
  const cats = [
    whenLabel ? { key: "when", label: whenLabel } : null,
    ageLabel ? { key: "age", label: ageLabel } : null,
    metroLabel ? { key: "metro", label: metroLabel } : null,
    districtLabel ? { key: "district", label: districtLabel } : null,
  ].filter((c): c is { key: string; label: string } => c !== null);
  
  // Show max 2 categories
  const visible = cats.slice(0, 2);
  const hiddenCount = cats.length - visible.length;
  
  // Compute mobile pill label and value
  const mobilePillLabel = cats.length > 0 ? "Выбрано" : "Фильтры";
  const mobilePillValue = (() => {
    if (cats.length === 0) return "Выберите...";
    const base = visible.map(v => v.label).join(", ");
    return hiddenCount > 0 ? `${base} +${hiddenCount}` : base;
  })();

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
  const handleWhenChangeDesktop = (val: string | Date | { from: Date; to: Date } | null) => {
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
    return (
      <div className="flex items-center gap-3 pb-2 w-full">
        <FilterFieldPill 
          label={mobilePillLabel}
          value={mobilePillValue}
          selected={cats.length > 0}
          onClick={() => setSheetOpen(true)}
          className="flex-1"
          rightIcon={<SlidersHorizontal className="h-4 w-4 opacity-50" />}
        />

        <MobileFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          filters={{
             when: applied.whenPreset === "TODAY" ? "today"
               : applied.whenPreset === "TOMORROW" ? "tomorrow"
               : applied.whenPreset === "WEEKEND" ? "weekend"
               : (applied.dateFrom ? (applied.dateTo ? { from: new Date(applied.dateFrom), to: new Date(applied.dateTo) } : new Date(applied.dateFrom)) : null),
             age: applied.age,
             metro: applied.metro,
             district: applied.district,
             nearby: false,
             dateFrom: applied.dateFrom,
             dateTo: applied.dateTo,
             whenPreset: applied.whenPreset,
          }}
          draft={applied}
          setDraft={setDraft}
          onDone={() => {
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

  const desktopTriggerClass =
    "flex-1 min-w-0 border-gray-200 bg-white hover:bg-gray-50";

  // DESKTOP - All filters use FilterFieldPill style
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {derived.isDirty && (
          <button
            onClick={actions.resetAll}
            className="flex h-[40px] w-[40px] min-w-[40px] items-center justify-center rounded-full border border-gray-200 bg-white text-muted-foreground transition-all hover:bg-gray-50 hover:text-foreground"
            title="Сбросить все фильтры"
          >
            <X className="h-5 w-5" />
          </button>
      )}
      
      {/* When Select - using default trigger (already matches FilterFieldPill style) */}
      <WhenSelect 
        className={desktopTriggerClass}
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
        className={desktopTriggerClass}
        uiMode="desktop"
        variant="card"
        applyMode="manual"
        closeOnApply={true}
        optionsLayout="masonry"
      />

      {/* Metro Select (SINGLE) - using default trigger (card variant matches FilterFieldPill) */}
      <CardSelect 
        label="Метро" 
        options={metroOptions} 
        value={applied.metro} 
        onChange={handleMetroChange} 
        allowClear
        className={desktopTriggerClass}
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
        className={desktopTriggerClass}
        uiMode="desktop"
        variant="card"
      />
    </div>
  );
}
