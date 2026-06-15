// Stable Card Selector - Reusable component for wizard card-based selections
// Prevents jumpy expand/collapse behavior with radio-style selection

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StableCardSelectorProps<T extends string> {
  value: T | null;
  onValueChange: (value: T) => void;
  options: Array<{
    value: T;
    label: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
    badge?: string;
    isRecommended?: boolean;
  }>;
  children?: (value: T) => React.ReactNode;
  isEditable?: boolean;
  className?: string;
}

export function StableCardSelector<T extends string>({
  value,
  onValueChange,
  options,
  children,
  isEditable = true,
  className
}: StableCardSelectorProps<T>) {
  const handleCardClick = (optionValue: T) => {
    // Radio behavior: only select if not already selected
    // Do NOT toggle to null if already selected
    if (value !== optionValue) {
      onValueChange(optionValue);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;

        return (
          <div key={option.value} className="space-y-0">
            {/* Main Card - Stable Layout */}
            <Card
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected
                  ? "ring-2 ring-[#EF8759] border-[#EF8759]"
                  : "hover:border-gray-300",
                !isEditable && "cursor-default opacity-60"
              )}
              onClick={() => isEditable && handleCardClick(option.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {Icon && (
                    <Icon 
                      className={cn(
                        "w-6 h-6 mt-1 flex-shrink-0",
                        isSelected ? "text-[#EF8759]" : "text-gray-600"
                      )} 
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-1">{option.label}</h3>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {option.badge && !isSelected && (
                      <Badge variant="outline" className="text-xs">
                        {option.badge}
                      </Badge>
                    )}
                    {option.isRecommended && !isSelected && (
                      <Badge variant="outline" className="text-xs">
                        Рекомендуется
                      </Badge>
                    )}
                    {isSelected && (
                      <Badge 
                        variant="default" 
                        className="bg-primary hover:bg-primary-hover text-xs"
                      >
                        Выбрано
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Nested Content Area - Only this animates */}
                {isSelected && children && (
                  <div
                    className={cn(
                      "mt-4 pt-4 border-t border-gray-200",
                      "animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {children(option.value)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

// Smaller variant for nested selections
interface StableCardSelectorSmallProps<T extends string> {
  value: T | null;
  onValueChange: (value: T) => void;
  options: Array<{
    value: T;
    label: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
    isRecommended?: boolean;
  }>;
  children?: (value: T) => React.ReactNode;
  isEditable?: boolean;
  className?: string;
}

export function StableCardSelectorSmall<T extends string>({
  value,
  onValueChange,
  options,
  children,
  isEditable = true,
  className
}: StableCardSelectorSmallProps<T>) {
  const handleCardClick = (optionValue: T) => {
    if (value !== optionValue) {
      onValueChange(optionValue);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;

        return (
          <div key={option.value} className="space-y-0">
            <Card
              className={cn(
                "cursor-pointer transition-all duration-200",
                isSelected
                  ? "ring-2 ring-[#EF8759] border-[#EF8759] bg-orange-50"
                  : "hover:border-gray-300",
                !isEditable && "cursor-default opacity-60"
              )}
              onClick={() => isEditable && handleCardClick(option.value)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {Icon && (
                    <Icon className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium text-sm">{option.label}</h5>
                      {isSelected && (
                        <Badge 
                          className="bg-primary hover:bg-primary-hover text-xs"
                        >
                          Выбрано
                        </Badge>
                      )}
                      {option.isRecommended && !isSelected && (
                        <Badge variant="outline" className="text-xs">
                          Рекомендуется
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>

                {isSelected && children && (
                  <div
                    className={cn(
                      "mt-3 pt-3 border-t border-gray-200",
                      "animate-in fade-in-0 slide-in-from-top-1 duration-180 ease-out"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {children(option.value)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
