# Filter Kit

A centralized, URL-driven filter system for Next.js App Router.

## Features
- **URL as Source of Truth**: Filters persist on reload and are shareable.
- **Responsive**: Popovers on Desktop, Bottom Sheets on Mobile.
- **Consistent UX**: Draft state while selecting, Apply to update URL.
- **Type-safe**: Defined via configuration objects.

## Usage

### 1. Define your filters
Create a config file (e.g., `src/features/filters/presets/myFilters.ts`):

```ts
import { FilterDef } from "@/features/filters/types";

export const myFilters: FilterDef[] = [
  {
    key: "category",
    label: "Category",
    mode: "single",
    options: [
      { value: "news", label: "News" },
      { value: "events", label: "Events" },
    ],
  },
  {
    key: "tags",
    label: "Tags",
    mode: "multi",
    options: [
      { value: "tech", label: "Technology" },
      { value: "art", label: "Art" },
    ],
  },
];
```

### 2. Add FilterBar to your page
Import the `FilterBar` component and your definitions.

```tsx
// src/app/my-page/page.tsx
import { FilterBar } from "@/features/filters/components/FilterBar";
import { myFilters } from "@/features/filters/presets/myFilters";

export default function MyPage() {
  return (
    <div className="space-y-4">
      <FilterBar defs={myFilters} />
      {/* Feed content uses useSearchParams() to read filters */}
    </div>
  );
}
```

### 3. Read filters in your feed
Use standard Next.js `searchParams` prop or `useSearchParams` hook to fetch data.

```tsx
// Server Component
export default function Page({ searchParams }: { searchParams: { [key: string]: string | string[] } }) {
  const category = searchParams.category;
  // ... fetch data
}
```

## Structure
- `types.ts`: Core type definitions.
- `url.ts`: URL parsing and serialization logic.
- `useFilterState.ts`: Main hook managing draft/applied state.
- `components/`: UI components (Bar, Control, OptionList).
