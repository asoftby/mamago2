"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { getFiltersForIntent, DEFAULT_INTENT } from "@/server/discovery/intentConfig";

type FilterDefinition = {
  id: string;
  slug: string;
  title: string;
  type: string;
  options: { value: string; label: string }[];
};

export function FilterBar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [availableFilters, setAvailableFilters] = useState<FilterDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentIntent = searchParams.get("intent") || DEFAULT_INTENT;
  
  // Load filters from API
  useEffect(() => {
    async function loadFilters() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/discovery/filters");
        if (res.ok) {
          const data = await res.json();
          setAvailableFilters(data);
        }
      } catch (e) {
        console.error("Failed to load filters", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadFilters();
  }, []);

  const relevantFilterSlugs = getFiltersForIntent(currentIntent);
  const visibleFilters = availableFilters.filter(f => relevantFilterSlugs.includes(f.slug));

  const handleFilterToggle = (filterSlug: string, optionValue: string, isMulti: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentValues = params.get(filterSlug)?.split(",").filter(Boolean) || [];
    
    let newValues: string[] = [];
    
    if (currentValues.includes(optionValue)) {
      newValues = currentValues.filter(v => v !== optionValue);
    } else {
      if (isMulti) {
        newValues = [...currentValues, optionValue];
      } else {
        newValues = [optionValue];
      }
    }

    if (newValues.length > 0) {
      params.set(filterSlug, newValues.join(","));
    } else {
      params.delete(filterSlug);
    }

    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    const params = new URLSearchParams(searchParams.toString());
    // Keep intent, remove everything else that matches a filter slug
    availableFilters.forEach(f => params.delete(f.slug));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const activeFiltersCount = Array.from(searchParams.entries()).filter(([key]) => 
    availableFilters.some(f => f.slug === key)
  ).length;

  if (isLoading) return <div className="h-12 w-full animate-pulse bg-muted rounded-md my-2" />;
  if (visibleFilters.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 px-2 text-muted-foreground">
            <X className="mr-1 h-3 w-3" />
            Сбросить
          </Button>
        )}
        
        {visibleFilters.map((filter) => {
          const currentValues = searchParams.get(filter.slug)?.split(",") || [];
          const isMulti = filter.type === "multi";

          return (
            <div key={filter.id} className="flex items-center gap-1 border rounded-full px-1 py-1 bg-background">
              <span className="text-xs font-medium pl-2 pr-1 text-muted-foreground">{filter.title}:</span>
              {filter.options.map((option) => {
                const isActive = currentValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleFilterToggle(filter.slug, option.value, isMulti)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-secondary text-secondary-foreground font-medium"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
