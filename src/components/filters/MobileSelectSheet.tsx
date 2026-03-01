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
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-3xl bg-background border-t border-border/60 shadow-2xl p-0 flex flex-col overflow-hidden gap-0"
      >
        {/* Header */}
        <div className="flex flex-col gap-4 p-4 border-b border-border/40 relative shrink-0">
          <div className="flex items-center justify-center relative">
             <SheetTitle>{title}</SheetTitle>
          </div>
          
          {/* Search Input */}
          {showSearch && (
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

        {/* Sticky Footer Action Bar */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3 pb-[calc(16px+env(safe-area-inset-bottom))] flex items-center justify-between shrink-0">
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
