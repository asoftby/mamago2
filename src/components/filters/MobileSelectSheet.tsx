"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";

export type Option = { value: string; label: string };

type MobileSelectSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: Option[];
  selectedValues: string[];
  isMulti?: boolean;
  onSelect: (value: string) => void;
  onClear: () => void;
  placeholderSearch?: string;
  maxSelected?: number;
  showSearch?: boolean;
  /** Список строк (метро/район) или masonry-чипы как в поиске (возраст) */
  layoutVariant?: "list" | "age-masonry";
};

export function MobileSelectSheet({
  open,
  onOpenChange,
  title,
  options,
  selectedValues,
  isMulti = false,
  onSelect,
  onClear,
  placeholderSearch = "Поиск...",
  maxSelected,
  showSearch = true,
  layoutVariant = "list",
}: MobileSelectSheetProps) {
  const [search, setSearch] = React.useState("");
  
  // Clear search when closed
  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  }, [options, search]);

  const isSelected = (val: string) => selectedValues.includes(val);
  const isMaxReached = maxSelected !== undefined && selectedValues.length >= maxSelected;

  const handleSelect = (val: string) => {
    onSelect(val);
    if (!isMulti) {
       // Optional: auto-close on single select? 
       // User prompt says: "single: selecting closes only when user presses “Готово” (mobile)"
       // So we do NOT close here.
    }
  };

  const handleDone = () => {
    onOpenChange(false);
  };

  const ageMasonryItems: ChipItem[] = filteredOptions.map((opt) => {
    const selected = isSelected(opt.value);
    const disabled = !selected && isMaxReached && isMulti;
    return {
      id: opt.value,
      label: opt.label,
      active: selected,
      disabled,
      onClick: () => handleSelect(opt.value),
    };
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-3xl border-t border-gray-200/80 bg-white shadow-2xl p-0 flex flex-col overflow-hidden gap-0"
      >
        {/* Header */}
        <div className="relative flex shrink-0 flex-col gap-4 border-b border-gray-200/80 bg-white p-4">
          <div className="flex items-center justify-center relative">
             <SheetTitle>{title}</SheetTitle>
          </div>
          
          {/* Search Input */}
          {layoutVariant === "list" && showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholderSearch}
                className="pl-9 h-10 bg-muted/30 border-none shadow-none focus-visible:ring-1"
              />
            </div>
          )}
        </div>

        {/* Content */}
        {layoutVariant === "age-masonry" ? (
          <div className="flex-1 overflow-y-auto pb-24">
            <div className="p-[15px]">
              <ChipsRow
                layout="masonry"
                aria-label={title}
                items={ageMasonryItems}
              />
            </div>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto px-2 py-2 pb-24">
          <div className="flex flex-col gap-1">
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const selected = isSelected(opt.value);
                const disabled = !selected && isMaxReached && isMulti;
                
                return (
                  <button
                    key={opt.value}
                    disabled={disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-3 rounded-xl text-left text-sm transition-colors",
                      selected 
                        ? "bg-primary/5 text-primary font-medium" 
                        : "hover:bg-muted/40",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span>{opt.label}</span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
        )}

        {/* Sticky Footer Action Bar */}
        <div className="sticky bottom-0 border-t border-gray-200/80 bg-white px-4 py-3 pb-[calc(16px+env(safe-area-inset-bottom))] flex items-center justify-between shrink-0">
          <button
            onClick={onClear}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Сбросить
          </button>
          <Button
            onClick={handleDone}
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
