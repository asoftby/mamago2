"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverPanelContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface PillPopoverSelectOption {
  value: string;
  label: string;
}

interface PillPopoverSelectProps {
  label?: string;
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: PillPopoverSelectOption[];
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}

export function PillPopoverSelect({
  label,
  placeholder = "Выберите...",
  value,
  onChange,
  options,
  allowClear = false,
  disabled = false,
  className,
}: PillPopoverSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(null);
    setOpen(false); // Optionally close on clear, or keep open
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-[56px] w-full justify-between rounded-full border bg-background px-5 py-3 hover:bg-muted/30 transition-all",
            "flex items-center text-left font-normal",
            className
          )}
        >
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            {label && (
              <span className="text-xs text-muted-foreground font-medium truncate">
                {label}
              </span>
            )}
            <span
              className={cn(
                "text-base truncate",
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
                onClick={handleClear}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </div>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverPanelContent 
        className="p-6 bg-background" 
        align="start"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                    // Size & Shape
                    "h-12 rounded-full px-6 py-3",
                    // Typography
                    "text-base font-medium",
                    // Default State
                    "border border-border/60 bg-background text-foreground hover:bg-muted/40",
                    // Selected State
                    isSelected && "border-primary/30 bg-primary/5 text-primary",
                    "max-w-full"
                  )}
                >
                  <span className="truncate max-w-[240px]">{option.label}</span>
                </button>
              );
            })}
          </div>
          
          {allowClear && value && (
            <div className="pt-2 border-t mt-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleClear()}
                    className="text-muted-foreground hover:text-foreground h-9 px-4 rounded-full"
                >
                    Сбросить выбор
                </Button>
            </div>
          )}
        </div>
      </PopoverPanelContent>
    </Popover>
  );
}
