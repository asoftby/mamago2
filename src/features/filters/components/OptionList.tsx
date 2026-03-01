import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Option, FilterMode } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OptionListProps {
  options: Option[];
  selectedValues: string[];
  mode: FilterMode;
  onSelect: (val: string) => void;
  maxHeight?: string;
}

export function OptionList({
  options,
  selectedValues,
  mode,
  onSelect,
  maxHeight = "320px",
}: OptionListProps) {
  
  const isSelected = (val: string) => selectedValues.includes(val);

  return (
    <ScrollArea className={cn("w-full overflow-y-auto", `max-h-[${maxHeight}]`)} style={{ maxHeight }}>
      <div className="flex flex-col p-1">
        {options.map((opt) => {
          const selected = isSelected(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={cn(
                "relative flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                selected && "font-medium bg-accent/50"
              )}
            >
              <span>{opt.label}</span>
              {selected && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
        {options.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Нет опций
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
