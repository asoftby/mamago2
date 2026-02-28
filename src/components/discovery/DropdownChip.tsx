"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

export type FilterOption = {
  value: string;
  label: string;
};

interface DropdownChipProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  isMulti?: boolean;
  onSelect: (value: string) => void;
  onClear?: () => void;
}

export function DropdownChip({
  label,
  options,
  selectedValues,
  isMulti = false,
  onSelect,
  onClear,
}: DropdownChipProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value)
  );

  const isActive = selectedValues.length > 0;

  const handleSelect = (value: string) => {
    onSelect(value);
    if (!isMulti) {
      setOpen(false);
    }
  };

  const getButtonLabel = () => {
    if (selectedValues.length === 0) return label;
    if (selectedValues.length === 1) return `${label}: ${selectedOptions[0]?.label}`;
    return `${label}: ${selectedValues.length} выбрано`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 justify-between rounded-xl px-3 font-normal transition-colors",
            isActive
              ? "bg-primary/5 border-primary/30 text-primary hover:bg-primary/10"
              : "bg-muted/50 border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="truncate mr-2">{getButtonLabel()}</span>
          <div className="flex items-center gap-1 shrink-0">
            {isActive && onClear && (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="rounded-full p-0.5 hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </div>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Поиск ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Ничего не найдено.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label} // Search by label
                    onSelect={() => handleSelect(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      if (onClear) onClear();
                      setOpen(false);
                    }}
                    className="justify-center text-center"
                  >
                    Сбросить фильтр
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
