"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export interface FilterSelectProps {
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  /** Первая опция с value=\"\" (например «Все статусы»), если её ещё нет в options. */
  placeholder?: string;
  /** Классы обёртки (`relative`). */
  className?: string;
  /** Доп. классы на нативном `<select>` (например высота для date-picker). */
  selectClassName?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  "aria-label"?: string;
}

/**
 * Единый нативный select для фильтров и форм в админке / бизнес-кабинете:
 * h-40px, pl-12px pr-36px, radius 12px, chevron справа с отступом 12px.
 */
export function FilterSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
  selectClassName,
  disabled,
  id,
  name,
  required,
  "aria-label": ariaLabel,
}: FilterSelectProps) {
  const mergedOptions = useMemo(() => {
    if (placeholder != null && placeholder !== "") {
      const hasEmpty = options.some((o) => o.value === "");
      if (!hasEmpty) {
        return [{ value: "", label: placeholder }, ...options];
      }
    }
    return options;
  }, [placeholder, options]);

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <select
        id={id}
        name={name}
        required={required}
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full min-w-0 appearance-none rounded-[12px] border border-input bg-background",
          "pl-[12px] pr-[36px] text-sm shadow-xs",
          "outline-none transition-[color,box-shadow]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          selectClassName,
        )}
      >
        {mergedOptions.map((o, i) => (
          <option key={`${o.value}-${i}`} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
