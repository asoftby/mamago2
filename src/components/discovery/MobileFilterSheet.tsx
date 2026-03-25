"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MobileDateSheet } from "@/components/filters/MobileDateSheet";
import { MobileSelectSheet } from "@/components/filters/MobileSelectSheet";
import { ChevronDown, X } from "lucide-react";
import { DiscoveryFilters as DiscoveryFiltersType } from "@/features/filters/discovery/filters.store";

type Option = { value: string; label: string };

// Refactored props to support draft state from parent
type MobileFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DiscoveryFiltersType & { when: any }; // 'when' is derived in parent for convenience but we can use dateFrom/dateTo
  // Actually, let's use the 'filters' object passed from parent which mimics the store shape but might have 'when' for UI
  // The parent passes: { when, age, metro, district }
  
  // New props for draft management
  draft: DiscoveryFiltersType;
  setDraft: (patch: Partial<DiscoveryFiltersType>) => void;
  onDone: () => void;
  onReset: () => void;
  
  ageOptions: Option[];
  metroOptions: Option[];
  districtOptions: Option[];
  
  // Legacy props kept optional to avoid breaking if not removed elsewhere yet
  onApply?: (filters: any) => void;
};

import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { whenLabel } from "@/features/filters/discovery/whenLabel";

export function MobileFilterSheet({
  open,
  onOpenChange,
  draft,
  setDraft,
  onDone,
  onReset,
  ageOptions,
  metroOptions,
  districtOptions,
}: MobileFilterSheetProps) {
  
  // Local state for which nested sheet is open
  const [dateSheetOpen, setDateSheetOpen] = React.useState(false);
  const [ageSheetOpen, setAgeSheetOpen] = React.useState(false);
  const [metroSheetOpen, setMetroSheetOpen] = React.useState(false);
  const [districtSheetOpen, setDistrictSheetOpen] = React.useState(false);

  // Helper to format date label
  const getDateLabel = () => {
    return whenLabel(draft);
  };

  // Helper for multi select labels
  const getMultiLabel = (values: string[], options: Option[], placeholder: string) => {
      if (values.length === 0) return placeholder;
      if (values.length === 1) {
          const opt = options.find(o => o.value === values[0]);
          return opt ? opt.label : values[0];
      }
      const first = options.find(o => o.value === values[0]);
      return `${first ? first.label : values[0]} +${values.length - 1}`;
  };

  // Helper for single select label
  const getSingleLabel = (value: string | null, options: Option[], placeholder: string) => {
      if (!value) return placeholder;
      const opt = options.find(o => o.value === value);
      return opt ? opt.label : value;
  };

  const TriggerButton = ({ label, valueLabel, onClick, onClear, isActive }: { label: string, valueLabel: string, onClick: () => void, onClear?: () => void, isActive: boolean }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-0.5 w-full text-left px-5 py-3 rounded-full border border-gray-200 bg-white transition-all min-h-[56px] justify-center hover:bg-gray-50",
        isActive && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col overflow-hidden">
            <span className="text-xs text-muted-foreground font-medium truncate">{label}</span>
            <span className={cn("text-sm truncate", !isActive && "text-muted-foreground")}>{valueLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
            {isActive && onClear && (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                    }}
                    className="rounded-full p-0.5 hover:bg-black/10 transition-colors"
                >
                    <X className="h-4 w-4" />
                </div>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
      </div>
    </button>
  );

  // Prepare "when" value for MobileDateSheet which expects complex object or string
  // We convert store strings to Date objects if needed, or pass strings if MobileDateSheet handles them.
  // MobileDateSheet uses WhenSelect internally which handles strings/dates.
  // But draft.dateFrom is ISO string. WhenSelect expects Date object for custom ranges?
  // Let's pass what WhenSelect supports.
  const whenValue = draft.whenPreset === "TODAY" ? "today"
    : draft.whenPreset === "TOMORROW" ? "tomorrow"
    : draft.whenPreset === "WEEKEND" ? "weekend"
    : (draft.dateFrom 
        ? (draft.dateTo 
            ? { from: new Date(draft.dateFrom), to: new Date(draft.dateTo) } 
            : new Date(draft.dateFrom))
        : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-3xl border-t border-gray-200/80 bg-white shadow-2xl p-0 flex flex-col overflow-hidden gap-0"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-center border-b border-gray-200/80 bg-white p-4 relative">
          <SheetTitle>Фильтры</SheetTitle>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
          <div className="flex flex-col gap-3">
            {/* When */}
            <div className="w-full">
               <TriggerButton 
                 label="Когда идем" 
                 valueLabel={getDateLabel()} 
                 isActive={!!draft.dateFrom || !!draft.whenPreset}
                 onClick={() => setDateSheetOpen(true)}
                 onClear={() => setDraft({ dateFrom: null, dateTo: null, whenPreset: null })}
               />
               <MobileDateSheet 
                 open={dateSheetOpen}
                 onOpenChange={setDateSheetOpen}
                 value={whenValue}
                 onChange={(val: any) => {
                     // Convert back to store format
                     if (!val) {
                         setDraft({ dateFrom: null, dateTo: null, whenPreset: null });
                     } else if (typeof val === 'string') {
                         // Handle preset strings
                         if (val === 'today') {
                             setDraft({ whenPreset: "TODAY", dateFrom: null, dateTo: null });
                         } else if (val === 'tomorrow') {
                             setDraft({ whenPreset: "TOMORROW", dateFrom: null, dateTo: null });
                         } else if (val === 'weekend') {
                             setDraft({ whenPreset: "WEEKEND", dateFrom: null, dateTo: null });
                         } else {
                             // Assume it's a date string
                             setDraft({ whenPreset: null, dateFrom: val, dateTo: null });
                         }
                     } else if (val instanceof Date) {
                         setDraft({ whenPreset: null, dateFrom: val.toISOString().split('T')[0], dateTo: null });
                     } else if ('from' in val) {
                         setDraft({ whenPreset: null, dateFrom: val.from.toISOString().split('T')[0], dateTo: val.to.toISOString().split('T')[0] });
                     }
                 }}
               />
            </div>

            {/* Age */}
            <div className="w-full">
              <TriggerButton 
                 label="Возраст"
                 valueLabel={getMultiLabel(draft.age, ageOptions, "Любой")}
                 isActive={draft.age.length > 0}
                 onClick={() => setAgeSheetOpen(true)}
                 onClear={() => setDraft({ age: [] })}
               />
               <MobileSelectSheet
                 open={ageSheetOpen}
                 onOpenChange={setAgeSheetOpen}
                 title="Возраст"
                 options={ageOptions}
                 selectedValues={draft.age}
                 onSelect={(val) => {
                     const exists = draft.age.includes(val);
                     if (exists) setDraft({ age: draft.age.filter(v => v !== val) });
                     else setDraft({ age: [...draft.age, val] });
                 }}
                 onClear={() => setDraft({ age: [] })}
                 isMulti={true}
                 placeholderSearch="Поиск возраста..."
                 showSearch={false}
                 layoutVariant="age-masonry"
               />
            </div>

            {/* Metro */}
            <div className="w-full">
               <TriggerButton 
                 label="Метро"
                 valueLabel={getSingleLabel(draft.metro, metroOptions, "Любое")}
                 isActive={!!draft.metro}
                 onClick={() => setMetroSheetOpen(true)}
                 onClear={() => setDraft({ metro: null })}
               />
               <MobileSelectSheet
                 open={metroSheetOpen}
                 onOpenChange={setMetroSheetOpen}
                 title="Метро"
                 options={metroOptions}
                 selectedValues={draft.metro ? [draft.metro] : []}
                 onSelect={(val) => {
                     setDraft({ metro: val });
                     setMetroSheetOpen(false); // Single select closes
                 }}
                 onClear={() => setDraft({ metro: null })}
                 isMulti={false}
                 placeholderSearch="Поиск метро..."
               />
            </div>

            {/* District */}
            <div className="w-full">
               <TriggerButton 
                 label="Район"
                 valueLabel={getSingleLabel(draft.district, districtOptions, "Любой")}
                 isActive={!!draft.district}
                 onClick={() => setDistrictSheetOpen(true)}
                 onClear={() => setDraft({ district: null })}
               />
               <MobileSelectSheet
                 open={districtSheetOpen}
                 onOpenChange={setDistrictSheetOpen}
                 title="Район"
                 options={districtOptions}
                 selectedValues={draft.district ? [draft.district] : []}
                 onSelect={(val) => {
                     setDraft({ district: val });
                     setDistrictSheetOpen(false); // Single select closes
                 }}
                 onClear={() => setDraft({ district: null })}
                 isMulti={false}
                 placeholderSearch="Поиск района..."
               />
            </div>
          </div>
        </div>

        {/* Sticky Footer Action Bar */}
        <div className="sticky bottom-0 border-t border-gray-200/80 bg-white px-4 py-3 pb-[calc(16px+env(safe-area-inset-bottom))] flex items-center justify-between shrink-0">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Сбросить
          </button>
          <Button
            onClick={onDone}
            variant="default"
            className="rounded-full shadow-lg active:scale-95 transition-all px-8 font-semibold"
          >
            Готово
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
