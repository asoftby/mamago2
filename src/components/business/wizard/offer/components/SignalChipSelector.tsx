// Signal Chip Selector Component
// Multi-select chips for signals

import { cn } from "@/lib/utils";
import { useState } from "react";

interface SignalOption {
  value: string;
  label: string;
  icon?: string;
}

interface SignalChipSelectorProps {
  label: string;
  description?: string;
  options: readonly SignalOption[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  min?: number;
  required?: boolean;
  collapsed?: boolean;
  disabled?: boolean;
}

export function SignalChipSelector({
  label,
  description,
  options,
  value,
  onChange,
  max,
  min = 0,
  required = false,
  collapsed = false,
  disabled = false,
}: SignalChipSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  
  const handleToggle = (optionValue: string) => {
    if (disabled) return;
    
    if (value.includes(optionValue)) {
      // Remove if already selected
      onChange(value.filter((v) => v !== optionValue));
    } else {
      // Add if not at max
      if (max && value.length >= max) {
        // If single select (max=1), replace
        if (max === 1) {
          onChange([optionValue]);
        } else {
          // Otherwise, don't add (show error?)
          return;
        }
      } else {
        onChange([...value, optionValue]);
      }
    }
  };
  
  if (collapsed && !isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">{label}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-1">
                {description}
              </div>
            )}
          </div>
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>
    );
  }
  
  const hasError = required && value.length < min;
  const isAtMax = typeof max === "number" && max > 0 && value.length >= max;
  
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <label className="text-sm font-medium flex items-center gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
          </label>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        
        {collapsed && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Скрыть
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = value.includes(option.value);
          const isDisabled = disabled || (!isSelected && isAtMax);
          
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              disabled={isDisabled}
              className={cn(
                "px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              {option.icon && <span className="mr-1.5">{option.icon}</span>}
              {option.label}
            </button>
          );
        })}
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className={cn(
          "text-muted-foreground",
          hasError && "text-red-500 font-medium"
        )}>
          {hasError && "Обязательное поле"}
          {!hasError && min > 0 && `Минимум: ${min}`}
        </div>
        
        {max && (
          <div className={cn(
            "text-muted-foreground",
            isAtMax && "text-orange-500 font-medium"
          )}>
            Выбрано: {value.length} / {max}
          </div>
        )}
      </div>
    </div>
  );
}
