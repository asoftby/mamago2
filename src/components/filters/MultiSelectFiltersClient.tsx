"use client"

import * as React from "react"
import { MultiSelectTab } from "@/components/ui/multiselect-tab"
import { useDiscoveryFilters } from "@/hooks/useDiscoveryFilters"
import { 
  AGE_OPTIONS, 
  DISTRICT_OPTIONS, 
  METRO_OPTIONS 
} from "@/lib/mocks/filterOptions"
import { Chip } from "@/components/ui/Chip"

export function MultiSelectFiltersClient({ 
  showAge = true, 
  showDistrict = true, 
  showMetro = true, 
}: { 
  showAge?: boolean 
  showDistrict?: boolean 
  showMetro?: boolean 
}) { 
  const { filters, isLoading } = useDiscoveryFilters();
  const [age, setAge] = React.useState<string[]>([]) 
  const [district, setDistrict] = React.useState<string[]>([]) 
  const [metro, setMetro] = React.useState<string[]>([]) 
  const [when, setWhen] = React.useState<string>("today")

  const ageFilter = filters?.find(f => f.slug === "age");
  const whenFilter = filters?.find(f => f.slug === "when");

  // Map database options to component options format
  const dbAgeOptions = ageFilter?.options.map(o => ({
    id: o.value,
    label: o.label
  })) || AGE_OPTIONS;

  if (isLoading) return <div className="h-10 animate-pulse bg-muted rounded-full w-full max-w-md" />;

  return ( 
    <div className="flex flex-col gap-4">
      {/* Single Select Filters (Tabs) - e.g. When */}
      {whenFilter && (
        <div className="flex flex-wrap gap-2">
          {whenFilter.options.map((option) => (
            <Chip 
              key={option.id} 
              active={when === option.value}
              onClick={() => setWhen(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      )}

      {/* Multi Select Filters */}
      <div className="flex flex-wrap gap-3"> 
        {showAge && ageFilter && ( 
          <MultiSelectTab 
            title={ageFilter.title} 
            options={dbAgeOptions} 
            value={age} 
            onChange={setAge} 
          /> 
        )} 
        {showDistrict && ( 
          <MultiSelectTab title="Район" options={DISTRICT_OPTIONS} value={district} onChange={setDistrict} /> 
        )} 
        {showMetro && ( 
          <MultiSelectTab title="Метро" options={METRO_OPTIONS} value={metro} onChange={setMetro} /> 
        )} 
      </div> 
    </div>
  ) 
}
