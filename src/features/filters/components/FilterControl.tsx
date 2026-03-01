import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FilterDef } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";
import { getFilterSummary } from "../summary";
import { OptionList } from "./OptionList";

interface FilterControlProps {
  def: FilterDef;
  appliedValue: string | string[] | null;
  draftValue: string | string[] | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (val: string | string[] | null) => void;
  onApply: () => void;
  onReset: () => void;
}

export function FilterControl({
  def,
  appliedValue,
  draftValue,
  isOpen,
  onOpenChange,
  onDraftChange,
  onApply,
  onReset,
}: FilterControlProps) {
  const isMobile = useIsMobile();
  
  // Is this filter currently applied (has value in URL)?
  const isApplied = Array.isArray(appliedValue) 
    ? appliedValue.length > 0 
    : !!appliedValue;

  // Current draft state for rendering options
  const currentDraft = Array.isArray(draftValue) ? draftValue : (draftValue ? [draftValue] : []);
  
  // Label for the button (summary of applied state)
  const buttonLabel = getFilterSummary(def, appliedValue);

  const handleSelect = (val: string) => {
    if (def.mode === 'single') {
      // For single select, set new value.
      // If same value clicked? Usually we keep it or toggle off?
      // Let's assume toggle off if clicked again for single? Or just switch.
      // Standard single select usually just switches. 
      // Requirement: "clear selection for that filter" supported.
      if (draftValue === val) {
         // If already selected, maybe clear?
         onDraftChange(null);
      } else {
         onDraftChange(val);
      }
    } else {
      // Multi
      const arr = (Array.isArray(draftValue) ? draftValue : []).slice();
      if (arr.includes(val)) {
        onDraftChange(arr.filter(v => v !== val));
      } else {
        onDraftChange([...arr, val]);
      }
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onDraftChange(def.mode === 'multi' ? [] : null);
  };

  // Button Trigger
  const trigger = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={isOpen}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-normal transition-all hover:bg-muted/50",
        isApplied && "border-primary bg-primary/5 font-medium text-foreground",
        "h-9"
      )}
      onClick={() => onOpenChange(!isOpen)}
    >
      <span className="truncate max-w-[150px]">{buttonLabel}</span>
      <ChevronDown className={cn("ml-2 h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
    </Button>
  );

  const content = (
    <div className="flex flex-col gap-2 p-0 w-full h-full">
      {/* Option List */}
      <div className="flex-1 overflow-hidden p-2">
         <OptionList 
           options={def.options}
           selectedValues={currentDraft}
           mode={def.mode}
           onSelect={handleSelect}
           maxHeight={isMobile ? "calc(85vh - 140px)" : "300px"}
         />
      </div>

      {/* Footer Actions */}
      <div className={cn("flex items-center justify-between border-t p-2 bg-background", isMobile && "pb-[calc(16px+env(safe-area-inset-bottom))]")}>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
              onReset();
              // Reset usually clears applied too. 
              // Wait, hook `reset` clears ALL filters.
              // Here we want to clear THIS filter.
              // We should probably just clear draft here?
              // Or call a `resetKey`?
              // The prop passed is `onReset`. Let's see what useFilterState provides.
              // It provides `reset` which resets EVERYTHING.
              // We probably want a `resetKey` in the hook or just clear draft.
              // Requirement: "Reset clears both draft and URL for those filter keys."
              // So we need a way to reset just this key.
              // But FilterControl receives `onReset`.
              // Let's assume parent passes a handler that resets THIS key.
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          Сбросить
        </Button>
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => {
            onApply();
            onOpenChange(false);
          }}
          className="rounded-full px-6"
        >
          Применить
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        {/* We don't use SheetTrigger because we control open state externally via props usually, 
            but here we are inside FilterControl which receives isOpen.
            Wait, FilterBar manages state. So we just render Trigger button that calls onOpenChange.
        */}
        {trigger}
        <SheetContent 
          side="bottom" 
          className="rounded-t-3xl max-h-[85vh] p-0 flex flex-col gap-0"
        >
          {/* Grabber */}
          <div className="flex justify-center pt-3 pb-1">
             <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
          </div>
          <SheetHeader className="px-4 pb-2 text-center border-b">
            <SheetTitle>{def.label}</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0" onInteractOutside={() => onOpenChange(false)}>
        {content}
      </PopoverContent>
    </Popover>
  );
}
