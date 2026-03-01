# Discovery Filters

Canonical filter system for Mamago discovery pages (City Intent, etc).

## Usage

```tsx
import { DiscoveryFilters } from "@/features/filters/discovery/DiscoveryFilters";

// Inside a Client Component or Server Component (it handles its own client logic)
export default function Page() {
  return (
    <div className="sticky top-0 z-10 ...">
      <DiscoveryFilters 
        ageOptions={...}
        metroOptions={...}
        districtOptions={...}
      />
    </div>
  );
}
```

## Key Files

- **Entry Point**: `src/features/filters/discovery/DiscoveryFilters.tsx`
- **Store/Logic**: `src/features/filters/discovery/filters.store.ts` (URL-driven hook)
- **Visuals**: `src/features/filters/ui/FilterPill.tsx` (Single source of truth for triggers)

## URL Parameters

The system strictly follows these URL query parameters:

- `from`: Date string (ISO or YYYY-MM-DD)
- `to`: Date string
- `age`: Comma-separated values (e.g. `0-1,1-3`)
- `metro`: Comma-separated values
- `district`: Single value

## Removed Legacy Components

The following components were removed in favor of this system:
- `src/components/filters/CityFiltersClient.tsx`
- `src/components/filters/MultiSelectFiltersClient.tsx`
- `src/components/discovery/FilterBar.tsx`
- `src/components/discovery/FilterBarV2.tsx`
- `src/components/city/CityIntentPage.tsx`
- `src/hooks/useDiscoveryFilters.ts` (legacy hook)
