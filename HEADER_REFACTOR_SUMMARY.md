# Desktop Header Refactor - Complete Summary

## What Was Changed

### 1. Files Modified
- `src/components/site/header/SiteHeader.desktop.tsx` - Complete architectural refactor
- `src/hooks/useHeaderScrolled.ts` - Updated threshold to 80px

### 2. HeaderShell Structure

**BEFORE:**
```tsx
<header className="w-full bg-white">
  <div className="relative overflow-hidden">
    <div className="grid transition-all">
```

**AFTER:**
```tsx
<header className="sticky top-0 z-50 w-full bg-white">
  <div className="h-[260px] → h-[100px]"> {/* Only this changes */}
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto]">
```

**Improvements:**
- Explicit `sticky top-0 z-50` on header
- Single height-controlled container
- Better grid structure with `minmax(0,1fr)`

### 3. Grid Layout

**Column Structure:**
```
[auto] [minmax(0,1fr)] [auto]
  ↓           ↓           ↓
 Logo      Center      Actions
(stable)  (animated)  (stable)
```

**Benefits:**
- `auto` columns size to content (stable anchors)
- `minmax(0,1fr)` allows center to flex without breaking
- No layout shift when center content changes

### 4. Stable Anchors

**Left Anchor:**
```tsx
<div className="flex items-center gap-3">
  <Image className="w-auto h-[60px]" />        // FIXED
  <Link className="w-[60px] h-[60px]" />       // FIXED
</div>
```

**Right Anchor:**
```tsx
<div className="flex items-center gap-3">
  <Link className="w-[60px] h-[60px]" />       // FIXED
  <Link className="w-[60px] h-[60px]" />       // FIXED
</div>
```

**Key Points:**
- No conditional classes
- No transitions
- No animations
- Fixed sizes
- Never re-render on scroll state

### 5. Center Stage (Animated)

**Structure:**
```tsx
<div className="relative min-h-[60px]">
  {/* Layer 1: Intent Tabs */}
  <div className="absolute inset-0 transition-[opacity,transform]">
    {isFull ? "visible" : "slide up & fade out"}
  </div>
  
  {/* Layer 2: Compact Search */}
  <div className="absolute inset-0 transition-[opacity,transform]">
    {isCompact ? "visible" : "slide down & fade out"}
  </div>
</div>
```

**Animations:**
- Tabs: `translate-y-0` → `-translate-y-8` (32px up)
- Compact Search: `translate-y-4` → `translate-y-0` (16px up)
- Both use opacity transitions
- Absolute positioning prevents layout shift

### 6. Tabs Slide Up Behavior

**Full State:**
```tsx
className={cn(
  "transition-[opacity,transform] duration-300 ease-out",
  isFull 
    ? "opacity-100 translate-y-0 pointer-events-auto" 
    : "opacity-0 -translate-y-8 pointer-events-none"
)}
```

**Effect:**
- Tabs visually "fly upward" out of view
- Clean, premium transition
- Matches Airbnb pattern

### 7. Compact Search in Upper Row

**Compact State:**
```tsx
<div className="absolute inset-0">
  <div className="w-full max-w-[600px]">
    <DesktopSearchControl isCompact={true} />
    <RefinementFiltersButtonCompact />
  </div>
</div>
```

**Position:**
- Lives in Row 1 center column
- Absolutely positioned within center stage
- Appears at same level as logo/actions
- Smooth transition from below

### 8. Hysteresis

**Configuration:**
```typescript
ENTER_THRESHOLD = 80px   // Enter compact
EXIT_THRESHOLD = 40px    // Exit compact
```

**Benefits:**
- Enter compact at 80px scroll
- Exit compact at 40px scroll
- 40px buffer zone prevents jitter
- requestAnimationFrame throttling

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ OUTER STICKY SHELL (height: 260px → 100px)             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ HEADER GRID (3 columns)                             │ │
│ │ ┌──────┬────────────────────────┬──────┐            │ │
│ │ │ LEFT │      CENTER STAGE      │RIGHT │  ROW 1    │ │
│ │ │ANCHOR│  [Tabs] or [Compact]   │ANCHOR│            │ │
│ │ │      │                        │      │            │ │
│ │ ├──────┼────────────────────────┼──────┤            │ │
│ │ │      │    [Full Search]       │      │  ROW 2    │ │
│ │ │      │   (full state only)    │      │ (optional)│ │
│ │ └──────┴────────────────────────┴──────┘            │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Why Logo/Actions Don't Participate

### Code Evidence

**Logo:**
```tsx
<Image
  src="/favico_mamago.webp"
  className="w-auto h-[60px]"  // No conditional, no transition
/>
```

**Actions:**
```tsx
<Link className="w-[60px] h-[60px]">  // No conditional, no transition
  <Heart className="h-7 w-7" />       // No conditional, no transition
</Link>
```

**No Scroll State Dependency:**
- No `isCompact` or `isFull` in className
- No `transition-*` classes
- Fixed sizes always
- Not wrapped in animated containers

## Why This Eliminates Flicker

### 1. Reduced Layout Calculations
**Before:** Browser recalculates logo, actions, tabs, search
**After:** Browser only recalculates center stage

### 2. Stable Anchor Points
**Before:** Logo/actions change size, causing layout shift
**After:** Logo/actions never change, no layout shift

### 3. Single Height Transition
**Before:** Multiple nested containers changing height
**After:** Only outer shell changes height

### 4. GPU Acceleration
**Before:** Mixed layout and paint operations
**After:** Pure compositor animations (opacity + transform)

### 5. Absolute Positioning
**Before:** Elements in flow cause reflow
**After:** Absolute layers don't affect flow

### 6. Hysteresis
**Before:** Rapid state changes at boundary (20px)
**After:** Wide buffer zone (40px) prevents jitter

### 7. No Max-Height
**Before:** `max-height` animation on row 2
**After:** Only opacity + transform on row 2

## Comparison Table

| Aspect | Before | After |
|--------|--------|-------|
| Logo size | 60px → 48px | 60px (fixed) |
| Action buttons | 60px → 48px | 60px (fixed) |
| Scroll threshold | 20px | 80px |
| Hysteresis | 20px → 10px | 80px → 40px |
| Grid columns | `[1fr_2fr_1fr]` | `[auto_minmax(0,1fr)_auto]` |
| Sticky position | Implicit | Explicit `sticky top-0 z-50` |
| Tabs exit | Scale down | Slide up 32px |
| Row 2 animation | max-height + opacity | opacity + transform |
| Logo re-renders | Yes (on scroll) | No |
| Actions re-renders | Yes (on scroll) | No |

## Testing Checklist

✅ Logo stays 60px in both states
✅ Actions stay 60px in both states
✅ Tabs slide upward when scrolling down
✅ Compact search appears in upper row
✅ Full search appears in lower row (full state)
✅ Header height: 260px (full) → 100px (compact)
✅ Hysteresis: Enter at 80px, exit at 40px
✅ No flicker during transition
✅ Smooth shadow transition
✅ No layout shift
✅ Filters button appears with compact search

## Result

Clean, professional desktop header that:
- ✅ Matches Airbnb behavior
- ✅ Eliminates flicker
- ✅ Uses stable anchor architecture
- ✅ Implements proper hysteresis
- ✅ Provides smooth GPU-accelerated transitions
- ✅ Maintains business logic (filters, query params)
- ✅ Doesn't affect mobile
