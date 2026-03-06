# Header Design System - Complete

## Overview
Created a comprehensive header design system with separate Desktop and Mobile implementations. Single source of truth with city label visible on both versions.

## Architecture

### Folder Structure
```
src/components/site/header/
├── SiteHeader.tsx           (Orchestrator)
├── SiteHeader.desktop.tsx   (Desktop layout)
├── SiteHeader.mobile.tsx    (Mobile layout)
└── index.ts                 (Exports)
```

### Import Pattern
```tsx
import { SiteHeader } from "@/components/site/header";
```

## Desktop Header

### File
`src/components/site/header/SiteHeader.desktop.tsx`

### Layout
**Single Row** - Flex layout with 3 sections:

```
┌─────────────────────────────────────────────────────────┐
│ [Logo + City]    [Search (centered, max 520px)]   [Heart + Profile] │
└─────────────────────────────────────────────────────────┘
```

### Structure
```tsx
<div className="flex h-16 items-center justify-between gap-6">
  <div className="flex-shrink-0">LEFT</div>
  <div className="flex-1 mx-auto max-w-[520px]">CENTER</div>
  <div className="flex-shrink-0">RIGHT</div>
</div>
```

### LEFT Block
- Logo: 40px height (`h-[40px] w-auto`)
- City: "Минск" with 20px left margin (`ml-[20px]`)
- Dashed underline: `border-muted-foreground/40`
- Hover: `border-muted-foreground/60`
- No wrapping: `whitespace-nowrap`

### CENTER Block
- Container: `flex-1 mx-auto max-w-[520px]`
- Search: Full width within container
- Rounded-full border
- Truncate text if too long
- Lucide Search icon (16px)

### RIGHT Block
- Heart icon (20px)
- "Профиль" text
- 16px gap (`gap-4`)
- No wrapping: `whitespace-nowrap`

## Mobile Header

### File
`src/components/site/header/SiteHeader.mobile.tsx`

### Layout
**Two Rows** - Premium mobile experience:

```
Row 1 (h-14):
┌─────────────────────────────────────┐
│ [Logo + City]    [Heart + User Icon] │
└─────────────────────────────────────┘

Row 2 (pb-3):
┌─────────────────────────────────────┐
│ [Full-width Search]                 │
└─────────────────────────────────────┘
```

### Row 1
**LEFT:**
- Logo: 32px height (smaller for mobile)
- City: "Минск" visible with dashed underline
- 12px gap (`ml-3`)
- Same styling as desktop

**RIGHT:**
- Heart icon (20px) - Saved
- User icon (20px) - Profile
- 12px gap (`gap-3`)
- Icons only (no text)

### Row 2
- Full-width search trigger
- Same styling as desktop
- No max-width constraint
- Padding bottom: 12px (`pb-3`)

### Key Features
- City label VISIBLE on mobile
- Two-row layout prevents cramping
- Icons instead of text for space
- Clean, premium feel

## Orchestrator

### File
`src/components/site/header/SiteHeader.tsx`

### Implementation
```tsx
export function SiteHeader() {
  return (
    <>
      {/* Desktop (md and up) */}
      <div className="hidden md:block">
        <SiteHeaderDesktop />
      </div>

      {/* Mobile (below md) */}
      <div className="block md:hidden">
        <SiteHeaderMobile />
      </div>
    </>
  );
}
```

### Breakpoint
- Mobile: `< 768px` (below md)
- Desktop: `≥ 768px` (md and up)
- Uses Tailwind breakpoints (no JS)
- No hooks or client-side detection

## Usage

### Public Layout
**File**: `src/app/(public)/layout.tsx`

```tsx
import { SiteHeader } from "@/components/site/header";

export default function PublicGroupLayout({ children }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <PublicFooter />
    </>
  );
}
```

### Single Render
- Only rendered once in public layout
- No duplicates in CityShell or other components
- Single source of truth

## UI-LAB Showcase

### File
`src/app/(ui)/ui-lab/_sections/HeaderSection.tsx`

### Sections
1. **Desktop Header Preview**
   - Full-width display
   - Shows single-row layout
   - Interactive demo

2. **Mobile Header Preview**
   - Constrained to 390px width
   - Shows two-row layout
   - Interactive demo

3. **Long City Name Test**
   - Tests "Санкт-Петербург"
   - Verifies no wrapping
   - Shows truncation behavior

### Important
- UI-LAB imports from production components
- No production code imports from UI-LAB
- Showcase only, not used in app

## Technical Details

### Icons
Using Lucide React:
```tsx
import { Heart, Search, User } from "lucide-react";
```

**Benefits:**
- Consistent icon set
- Tree-shakeable
- Standard sizing
- Better performance

### Responsive Strategy
**CSS-only** (no JavaScript):
```tsx
<div className="hidden md:block">Desktop</div>
<div className="block md:hidden">Mobile</div>
```

**Why This Works:**
- No hydration issues
- No flash of wrong content
- Better performance
- Simpler code

### Spacing
**Desktop:**
- Logo to City: 20px (`ml-[20px]`)
- Sections: 24px (`gap-6`)
- Heart to Profile: 16px (`gap-4`)

**Mobile:**
- Logo to City: 12px (`ml-3`)
- Icons: 12px (`gap-3`)
- Row 2 padding: 12px (`pb-3`)

### Heights
**Desktop:**
- Header: 64px (`h-16`)
- Logo: 40px (`h-[40px]`)

**Mobile:**
- Row 1: 56px (`h-14`)
- Logo: 32px (`h-[32px]`)
- Row 2: Auto with padding

## Key Features

### ✅ City Visible on Mobile
- "Минск" label shown on both desktop and mobile
- Same dashed underline styling
- Consistent branding

### ✅ Responsive Without JS
- Pure CSS breakpoints
- No client-side detection
- No hydration issues
- Better performance

### ✅ Single Source of Truth
- One orchestrator component
- Separate desktop/mobile files
- Clean imports
- Easy to maintain

### ✅ Premium Mobile Experience
- Two-row layout
- No cramping
- Icons for space efficiency
- Full-width search

### ✅ Stable Desktop Layout
- Flex-based (not grid)
- No wrapping
- Centered search
- Predictable behavior

## Comparison: Desktop vs Mobile

### Desktop
- **Layout**: Single row
- **Logo**: 40px height
- **City**: 20px spacing
- **Search**: Centered, max 520px
- **Actions**: Heart + "Профиль" text
- **Height**: 64px

### Mobile
- **Layout**: Two rows
- **Logo**: 32px height
- **City**: 12px spacing, visible
- **Search**: Full-width, row 2
- **Actions**: Heart + User icons
- **Height**: ~90px total

## Build Status

✅ Build passes with 0 errors
✅ TypeScript compilation clean
✅ All diagnostics clear
✅ No hydration issues
✅ Responsive works correctly
✅ UI-LAB showcase functional

## Files Created

### Components:
```
src/components/site/header/
├── SiteHeader.tsx
├── SiteHeader.desktop.tsx
├── SiteHeader.mobile.tsx
└── index.ts
```

### UI-LAB:
```
src/app/(ui)/ui-lab/_sections/
└── HeaderSection.tsx
```

### Modified:
```
src/app/(public)/layout.tsx (updated import)
src/app/(ui)/ui-lab/page.tsx (added HeaderSection)
```

### Deleted:
```
src/components/site/SiteHeader.tsx (old single file)
src/components/shell/PublicHeader.tsx (deprecated)
```

## Acceptance Checklist

✅ One canonical header component
✅ Desktop + Mobile in separate files
✅ City visible on mobile
✅ Search visible on both
✅ No duplicates
✅ No JS-based detection
✅ Tailwind breakpoints only
✅ No imports from /ui-lab in production
✅ UI-LAB showcase created
✅ Long city name tested
✅ Build passes
✅ Single source of truth
✅ Clean folder structure
✅ Proper exports

## Design Decisions

### Why Flex Instead of Grid?
- Simpler for single-row layout
- Better browser support
- Easier to understand
- No Tailwind generation issues

### Why Two Rows on Mobile?
- Prevents cramping
- Better UX
- More space for search
- Premium feel

### Why Icons Only on Mobile?
- Space efficiency
- Common pattern
- Still accessible (aria-labels)
- Cleaner look

### Why Separate Files?
- Better organization
- Easier to maintain
- Clear separation of concerns
- Can optimize separately

### Why Orchestrator Pattern?
- Single import point
- Clean API
- Easy to swap implementations
- Testable

## Next Steps (Optional)

### Enhancements:
- Add city selector dropdown
- Add real search functionality
- Add user avatar
- Add notifications badge
- Add keyboard shortcuts

### Optimizations:
- Lazy load mobile/desktop
- Preload critical images
- Add loading states
- Optimize for Core Web Vitals

### Features:
- Search autocomplete
- Recent searches
- City switching
- User menu dropdown
- Mobile menu

## Success Metrics

✅ Single source of truth
✅ Desktop + Mobile implementations
✅ City visible on both
✅ Responsive without JS
✅ Clean architecture
✅ UI-LAB showcase
✅ No duplicates
✅ Build passes
✅ Production-ready
✅ Maintainable code
