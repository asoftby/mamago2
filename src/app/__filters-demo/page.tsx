"use client";

import * as React from "react";
import { FilterBar } from "@/features/filters/components/FilterBar";
import { minskActivitiesFilters } from "@/features/filters/presets/minskActivitiesFilters";
import { useSearchParams } from "next/navigation";

export default function FiltersDemoPage() {
  const searchParams = useSearchParams();
  
  // Debug view of current URL params
  const paramsObj: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    paramsObj[key] = val;
  });

  return (
    <div className="min-h-screen bg-background p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Filter System Demo</h1>
        <p className="text-muted-foreground">
          Reference implementation of the centralized filter system.
        </p>
      </div>

      <div className="border rounded-xl p-4 bg-card space-y-4">
        <h2 className="font-semibold">Filter Bar</h2>
        <FilterBar defs={minskActivitiesFilters} />
      </div>

      <div className="border rounded-xl p-4 bg-muted/50 font-mono text-sm">
        <h2 className="font-semibold mb-2">Current URL Params (Applied State):</h2>
        <pre>{JSON.stringify(paramsObj, null, 2)}</pre>
      </div>
    </div>
  );
}
