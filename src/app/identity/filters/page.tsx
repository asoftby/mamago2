"use client";

import { DiscoveryFilters } from "@/features/filters/discovery/DiscoveryFilters";
import { FilterPill } from "@/features/filters/ui/FilterPill";
import { useState } from "react";

// Mock options for the lab
const AGE_OPTIONS = [
  { value: "0-1", label: "0-1 год" },
  { value: "1-3", label: "1-3 года" },
  { value: "3-5", label: "3-5 лет" },
  { value: "6-9", label: "6-9 лет" },
];

const METRO_OPTIONS = [
  { value: "uruchie", label: "Уручье" },
  { value: "oktyabrskaya", label: "Октябрьская" },
  { value: "nemiga", label: "Немига" },
];

const DISTRICT_OPTIONS = [
  { value: "center", label: "Центральный" },
  { value: "frunz", label: "Фрунзенский" },
];

export default function FiltersUILabPage() {
  const [demoPillActive, setDemoPillActive] = useState(false);

  return (
    <div className="min-h-screen bg-background p-8 space-y-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Filters UI Lab</h1>
        <p className="text-muted-foreground">
          Playground for testing filter visuals and responsiveness.
        </p>
      </div>

      {/* 1. Component Sandbox */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">1. FilterPill Component</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <FilterPill label="Default" />
          <FilterPill label="Active" isActive={true} />
          <FilterPill label="With Value" valueText="3 selected" isActive={true} />
          <FilterPill 
            label="Interactive" 
            valueText={demoPillActive ? "Active" : undefined}
            isActive={demoPillActive}
            onClick={() => setDemoPillActive(!demoPillActive)}
          />
          <FilterPill label="Disabled" disabled />
        </div>
      </section>

      {/* 2. Desktop Filters */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">2. DiscoveryFilters (Desktop Mode)</h2>
        <div className="p-6 border rounded-xl bg-card">
          <DiscoveryFilters 
            forceUIMode="desktop"
            ageOptions={AGE_OPTIONS}
            metroOptions={METRO_OPTIONS}
            districtOptions={DISTRICT_OPTIONS}
          />
        </div>
      </section>

      {/* 3. Mobile Filters */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b pb-2">3. DiscoveryFilters (Mobile Mode)</h2>
        <p className="text-sm text-muted-foreground">
          Renders the mobile trigger button. Click to open the sheet.
        </p>
        <div className="p-6 border rounded-xl bg-card max-w-sm mx-auto sm:mx-0">
          <DiscoveryFilters 
            forceUIMode="mobile"
            ageOptions={AGE_OPTIONS}
            metroOptions={METRO_OPTIONS}
            districtOptions={DISTRICT_OPTIONS}
          />
        </div>
      </section>

      {/* 4. Debug */}
      <section className="space-y-4 pt-8">
        <div className="p-4 bg-muted/50 rounded-lg text-xs font-mono">
          <p>Current URL Search Params:</p>
          {/* Note: This is client-side only */}
          <SearchParamsDebug />
        </div>
      </section>
    </div>
  );
}

function SearchParamsDebug() {
  // We can't access window during SSR, but this is a client component
  const [params, setParams] = useState("");
  
  // Use a polling or effect to update params? 
  // Actually useSearchParams hook is better but we are inside the page.
  // Let's just use window.location if mounted.
  
  // Or import useSearchParams
  const { useSearchParams } = require("next/navigation");
  const searchParams = useSearchParams();
  
  return (
    <div className="mt-2 break-all">
      {searchParams.toString() || "(empty)"}
    </div>
  );
}
