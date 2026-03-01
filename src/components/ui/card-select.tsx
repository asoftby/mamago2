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
import { MobileSelectSheet } from "@/components/filters/MobileSelectSheet";

export interface CardSelectOption {
  value: string;
  label: string;
}

interface CardSelectProps {
  label?: string;
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: CardSelectOption[];
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  variant?: "card" | "pill";
  uiMode?: "mobile" | "desktop";
}

export function CardSelect({
  label,
  placeholder = "Выберите...",
  value,
  onChange,
  options,
  allowClear = false,
  disabled = false,
  className,
  variant = "card",
  uiMode,
}: CardSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const isMobileQuery = useIsMobile();
  const isMobile = uiMode ? uiMode === "mobile" : isMobileQuery;
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(null);
    setOpen(false);
  };
  
  // Styles for pill variant
  const isPill = variant === "pill";
  const pillStyles = isPill
    ? cn(
        "h-12 min-h-0 w-auto justify-between rounded-full border px-6 py-3 transition-all",
        value && "bg-primary/10 border-primary/30",
        "flex items-center gap-2"
      )
    : cn(
        "h-auto min-h-[56px] w-full justify-between rounded-full border bg-background px-5 py-3 hover:bg-muted/30 transition-all",
        "flex items-center text-left font-normal",
        value && "border-primary bg-primary/5"
      );

  const trigger = (
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onClick={isClient && isMobile ? () => setOpen(true) : undefined}
          className={cn(pillStyles, className)}
        >
          {isPill ? (
            // Pill Layout
            <>
              <span className={cn("text-xs font-medium", !value && "text-muted-foreground")}>
                {selectedOption ? selectedOption.label : label || placeholder}
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                 {allowClear && value && !disabled && (
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
                    !value && "text-muted-foreground"
                  )}
                >
                  {selectedOption ? selectedOption.label : placeholder}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {allowClear && value && !disabled && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(null);
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

  if (isClient && isMobile) {
    return (
      <>
        {trigger}
        <MobileSelectSheet
          open={open}
          onOpenChange={setOpen}
          title={label || placeholder}
          options={options}
          selectedValues={value ? [value] : []}
          onSelect={handleSelect}
          onClear={() => onChange(null)}
          isMulti={false}
          placeholderSearch="Поиск..."
        />
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverPanelContent 
        className="min-h-[350px] h-auto bg-background" 
        align="start"
      >
        <div className="flex flex-col gap-1">
          {options.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl transition-all hover:bg-muted/40",
                  "flex items-center justify-between",
                  selected && "bg-primary/5 text-primary font-medium"
                )}
              >
                <span className="text-sm">{option.label}</span>
                {selected && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
          
          {allowClear && value && (
            <div className="pt-2 border-t mt-2">
              <button 
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground py-2"
              >
                  Сбросить выбор
              </button>
            </div>
          )}
        </div>
      </PopoverPanelContent>
    </Popover>
  );
}
