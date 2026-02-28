"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { DropdownChip, FilterOption } from "./DropdownChip";
import { getFiltersForIntent, DEFAULT_INTENT } from "@/server/discovery/intentConfig";

type FilterDefinition = {
  id: string;
  slug: string;
  title: string;
  type: string;
  options: { value: string; label: string }[];
};

export function FilterMasonryMenu() {
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
  const visibleFilters = availableFilters.filter((f) => relevantFilterSlugs.includes(f.slug));

  const handleSelect = (filterSlug: string, optionValue: string, isMulti: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    const currentValues = params.get(filterSlug)?.split(",").filter(Boolean) || [];

    let newValues: string[] = [];

    if (currentValues.includes(optionValue)) {
      newValues = currentValues.filter((v) => v !== optionValue);
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

  const handleClearFilter = (filterSlug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(filterSlug);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleResetAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    availableFilters.forEach((f) => params.delete(f.slug));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const activeFiltersCount = Array.from(searchParams.entries()).filter(([key]) =>
    availableFilters.some((f) => f.slug === key)
  ).length;

  if (isLoading) {
    return <div className="h-10 w-full animate-pulse bg-muted/50 rounded-xl my-2" />;
  }

  if (visibleFilters.length === 0) return null;

  return (
    <div className="py-2">
      <div
        className="
          grid gap-2 
          grid-cols-[repeat(auto-fit,minmax(140px,1fr))] 
          sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]
          md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]
          lg:grid-cols-[repeat(4,minmax(0,1fr))]
        "
      >
        {visibleFilters.map((filter) => {
          const currentValues = searchParams.get(filter.slug)?.split(",").filter(Boolean) || [];
          const isMulti = filter.type === "multi";
          
          return (
            <DropdownChip
              key={filter.id}
              label={filter.title}
              options={filter.options}
              selectedValues={currentValues}
              isMulti={isMulti}
              onSelect={(val) => handleSelect(filter.slug, val, isMulti)}
              onClear={currentValues.length > 0 ? () => handleClearFilter(filter.slug) : undefined}
            />
          );
        })}

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            onClick={handleResetAll}
            className="h-10 px-3 rounded-xl text-muted-foreground hover:text-foreground justify-start"
          >
            <X className="mr-2 h-4 w-4" />
            Сбросить
          </Button>
        )}
      </div>
    </div>
  );
}
