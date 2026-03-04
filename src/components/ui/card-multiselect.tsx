"use client";

import * as React from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverPanelContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHydrated } from "@/hooks/use-hydrated";
import { MobileSelectSheet } from "@/components/filters/MobileSelectSheet";

export interface CardMultiSelectOption {
  value: string;
  label: string;
}

interface CardMultiSelectProps {
  label?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: CardMultiSelectOption[];
  allowClear?: boolean;
  disabled?: boolean;
  maxSelected?: number;
  className?: string;
  variant?: "card" | "pill";
  uiMode?: "mobile" | "desktop";
  trigger?: React.ReactNode;
  applyMode?: "instant" | "manual"; // New: manual mode requires Apply button
  closeOnApply?: boolean; // New: close dropdown after Apply (default true for manual)
}

export function CardMultiSelect({
  label,
  placeholder = "Выберите...",
  values,
  onChange,
  options,
  allowClear = false,
  disabled = false,
  maxSelected,
  className,
  variant = "card",
  uiMode,
  trigger: customTrigger,
  applyMode = "instant",
  closeOnApply = true,
}: CardMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const hydrated = useHydrated();
  const isMobileQuery = useIsMobile();
  // Gate mobile detection until after hydration to prevent SSR/CSR mismatch
  const isMobile = uiMode ? uiMode === "mobile" : (hydrated && isMobileQuery);
  
  // Draft values for manual mode
  const [draftValues, setDraftValues] = React.useState<string[]>(values);
  
  // Sync draft with props when dropdown opens or values change externally
  React.useEffect(() => {
    if (open || applyMode === "instant") {
      setDraftValues(values);
    }
  }, [open, values, applyMode]);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Use draft values in manual mode, actual values in instant mode
  const effectiveValues = applyMode === "manual" ? draftValues : values;
  const selectedOptions = options.filter((opt) => effectiveValues.includes(opt.value));
  
  // Calculate display label (always use actual values for trigger, not draft)
  let valueLabel: string | null = null;
  if (values.length === 0) {
    valueLabel = null;
  } else if (values.length === 1) {
    const firstOption = options.find(o => o.value === values[0]);
    valueLabel = firstOption ? firstOption.label : values[0];
  } else {
    // > 1
    const firstOption = options.find(o => o.value === values[0]);
    const firstLabel = firstOption ? firstOption.label : values[0];
    valueLabel = `${firstLabel} +${values.length - 1}`;
  }

  const isSelected = (val: string) => effectiveValues.includes(val);
  const isMaxReached = maxSelected !== undefined && effectiveValues.length >= maxSelected;

  const toggle = (val: string) => {
    if (applyMode === "manual") {
      // Manual mode: update draft only
      if (isSelected(val)) {
        setDraftValues(effectiveValues.filter((v) => v !== val));
      } else {
        if (isMaxReached) return;
        setDraftValues([...effectiveValues, val]);
      }
    } else {
      // Instant mode: call onChange immediately
      if (isSelected(val)) {
        onChange(values.filter((v) => v !== val));
      } else {
        if (isMaxReached) return;
        onChange([...values, val]);
      }
    }
  };

  const handleApply = () => {
    onChange(draftValues);
    if (closeOnApply) {
      setOpen(false);
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (applyMode === "manual") {
      setDraftValues([]);
      onChange([]);
    } else {
      onChange([]);
    }
    setOpen(false);
  };

  // Styles for pill variant
  const isPill = variant === "pill";
  const pillStyles = isPill
    ? cn(
        "h-12 min-h-0 w-auto justify-between rounded-full border px-6 py-3 transition-all",
        values.length > 0 && "bg-primary/10 border-primary/30",
        "flex items-center gap-2"
      )
    : cn(
        "h-auto min-h-[56px] w-full justify-between rounded-full border bg-background px-5 py-3 hover:bg-muted/30 transition-all",
        "flex items-center text-left font-normal",
        values.length > 0 && "border-primary bg-primary/5"
      );

  const trigger = (
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onClick={isMobile ? () => setOpen(true) : undefined}
          className={cn(pillStyles, className)}
        >
          {isPill ? (
            // Pill Layout
            <>
              <span className={cn("text-xs font-medium", !valueLabel && "text-muted-foreground")}>
                {valueLabel || label || placeholder}
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                 {allowClear && values.length > 0 && !disabled && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleClear}
                    className="rounded-full p-0.5 hover:bg-black/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </div>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </div>
            </>
          ) : (
            // Card Layout
            <>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                {label && (
                  <span className="text-xs text-muted-foreground font-medium truncate">
                    {label}
                  </span>
                )}
                <span
                  className={cn(
                    "text-sm truncate",
                    !valueLabel && "text-muted-foreground"
                  )}
                >
                  {valueLabel || placeholder}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {allowClear && values.length > 0 && !disabled && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange([]);
                    }}
                    className="rounded-full p-0.5 hover:bg-black/10 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </div>
                )}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </div>
            </>
          )}
        </Button>
  );

  if (isMobile) {
    return (
      <>
        {customTrigger || trigger}
        <MobileSelectSheet
          open={open}
          onOpenChange={setOpen}
          title={label || placeholder}
          options={options}
          selectedValues={values}
          onSelect={toggle}
          onClear={() => onChange([])}
          isMulti={true}
          maxSelected={maxSelected}
          placeholderSearch="Поиск..."
        />
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {customTrigger || trigger}
      </PopoverTrigger>
      <PopoverPanelContent 
        className="bg-background p-0 w-[320px]"
        align="start"
      >
        {applyMode === "manual" ? (
          // Manual mode: scrollable list + conditional sticky footer
          <div className="relative max-h-[70vh] w-full">
            {/* Scrollable options list */}
            <div className={cn(
              "overflow-auto",
              draftValues.length > 0 ? "pb-16" : "pb-1"
            )}>
              <div className="p-1">
                {options.map((option) => {
                  const selected = isSelected(option.value);
                  const itemDisabled = !selected && isMaxReached;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={itemDisabled}
                      onClick={() => toggle(option.value)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl transition-all hover:bg-muted/40",
                        "flex items-center justify-between",
                        selected && "bg-primary/5 text-primary font-medium",
                        itemDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span className="text-sm">{option.label}</span>
                      {selected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Sticky footer - only show when selections exist */}
            {draftValues.length > 0 && (
              <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-3">
                <Button 
                  onClick={handleApply}
                  className="w-full rounded-full"
                  size="default"
                >
                  Применить
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Instant mode: original layout
          <div className="flex flex-col gap-1 p-1">
            {options.map((option) => {
              const selected = isSelected(option.value);
              const itemDisabled = !selected && isMaxReached;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={itemDisabled}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl transition-all hover:bg-muted/40",
                    "flex items-center justify-between",
                    selected && "bg-primary/5 text-primary font-medium",
                    itemDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="text-sm">{option.label}</span>
                  {selected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
            
            {allowClear && values.length > 0 && (
              <div className="pt-2 border-t mt-2 flex justify-between items-center px-2">
                  <span className="text-xs text-muted-foreground">Выбрано: {values.length}</span>
                  <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onChange([])}
                      className="text-muted-foreground hover:text-foreground h-9 px-4 rounded-full"
                  >
                      Сбросить все
                  </Button>
              </div>
            )}
          </div>
        )}
      </PopoverPanelContent>
    </Popover>
  );
}
