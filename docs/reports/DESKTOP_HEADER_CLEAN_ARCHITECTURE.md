# Desktop Header Clean Architecture - Final Implementation

## Overview
Complete refactor of desktop header with clean architectural principles to eliminate flicker and match Airbnb behavior.

## Architecture Components

### 1. OUTER STICKY SHELL
```tsx
<header className="sticky top-0 z-50 w-full bg-white border-b">
  <div className="mx-auto w-full max-w-[1200px] px-4">
    <div className="h-[260px] → h-[100px]"> {/* Only this changes height */}
```

**Properties:**
- `sticky top-0 z-50`: Proper sticky positioning
- Single height transition: 260px (full) → 100px (compact)
- No nested sticky wrappers
- Smooth shadow transition

### 2. HEADER GRID (3 Columns)
```tsx
<div className="grid grid-cols-[auto_minmax(0,1fr)_auto]">
```

**Column Structure:**
- `auto`: Left anchor (content-sized)
- `minmax(0,1fr)`: Center stage (flexible)
- `auto`: Right anchor (content-sized)

### 3. LEFT ANCHOR (Stable)
```tsx
<div className="flex items-center gap-3">
  <Image className="w-auto h-[60px]" /> {/* FIXED */}
  <Link className="w-[60px] h-[60px]" /> {/* FIXED */}
</div>
```

**Never changes:**
- Logo: Always 60px
- Search button: Always 60px × 60px
- No transitions
- No animations
- No re-renders on scroll state

### 4. CENTER STAGE (Animated)
```tsx
<div className="relative min-h-[60px]">
  {/* Layer 1: Tabs */}
  {/* Layer 2: Compact Search */}
</div>
```

**Layers:**
- Intent Tabs: Slides up (-32px) and fades out
- Compact Search: Slides up from below (+16px) and fades in
- Absolute positioning for smooth crossfade

### 5. RIGHT ANCHOR (Stable)
```tsx
<div className="flex items-center gap-3">
  <Link className="w-[60px] h-[60px]" /> {/* FIXED */}
  <Link className="w-[60px] h-[60px]" /> {/* FIXED */}
</div>
```

**Never changes:**
- Favorites: Always 60px × 60px
- Profile: Always 60px × 60px
- No transitions
- No animations
- No re-renders on scroll state

## State Transitions

### FULL STATE (2 Rows)
```
Row 1: [Logo + Search] [Intent Tabs] [Heart + Profile]
Row 2:                  [Full Search]
```

Height: 260px
Grid: `grid-rows-[auto_auto]`

### COMPACT STATE (1 Row)
```
Row 1: [Logo + Search] [Compact Search + Filters] [Heart + Profile]
```

Height: 100px
Grid: `grid-rows-[auto]`

## Transition Behavior

### Full → Compact (Scroll Down > 80px)
1. Intent tabs slide up 32px and fade out
2. Compact search slides up 16px and fades in
3. Full search (row 2) fades out and slides up
4. Header height: 260px → 100px
5. Logo/actions: No change

### Compact → Full (Scroll Up < 40px)
1. Compact search slides down and fades out
2. Intent tabs slide down and fade in
3. Full search (row 2) fades in and slides down
4. Header height: 100px → 260px
5. Logo/actions: No change

## Hysteresis Implementation

```typescript
ENTER_THRESHOLD = 80px  // Enter compact
EXIT_THRESHOLD = 40px   // Exit compact (50% of enter)
```

**Benefits:**
- Prevents jitter at boundary
- Smooth state transitions
- No rapid toggling
- requestAnimationFrame throttling

## Why This Eliminates Flicker

### 1. Stable Anchors
- Logo and actions never re-render
- No size changes
- No position changes
- Browser doesn't recalculate their layout

### 2. Single Height Transition
- Only outer shell changes height
- No cascading height changes
- No multiple layout recalculations

### 3. GPU-Accelerated Animations
- `opacity`: GPU-accelerated
- `transform`: GPU-accelerated
- No `max-height` on key elements
- Compositor thread handles animations

### 4. Absolute Positioning
- Center layers don't affect layout flow
- Smooth crossfade without reflow
- Parent maintains stable height

### 5. Proper Grid Structure
- `auto` columns for anchors (content-sized)
- `minmax(0,1fr)` for center (flexible)
- No layout shift when center changes

### 6. Hysteresis
- Prevents rapid state changes
- Reduces re-render frequency
- Smoother perceived transition

## Files Modified

1. `src/components/site/header/SiteHeader.desktop.tsx`
   - Added explicit architectural comments
   - Changed threshold to 80px
   - Renamed variables: `showFull/showCompact` → `isFull/isCompact`
   - Added `sticky` to header element
   - Improved grid structure with `minmax(0,1fr)`
   - Removed `max-height` from row 2
   - Cleaner layer organization

2. `src/hooks/useHeaderScrolled.ts`
   - Updated default threshold: 20px → 80px
   - Updated comments for clarity

## Architecture Summary

**HeaderShell** (Sticky Outer Container)
├── **HeaderGrid** (3-column grid)
│   ├── **LeftAnchor** (Stable)
│   │   ├── Logo (60px fixed)
│   │   └── Global Search (60px × 60px fixed)
│   ├── **CenterStage** (Animated)
│   │   ├── Layer 1: Intent Tabs (slides up)
│   │   ├── Layer 2: Compact Search (slides up)
│   │   └── Row 2: Full Search (fades out)
│   └── **RightAnchor** (Stable)
│       ├── Favorites (60px × 60px fixed)
│       └── Profile (60px × 60px fixed)

**Stable Parts:**
- LeftAnchor: Logo + Global Search
- RightAnchor: Favorites + Profile

**Animated Parts:**
- CenterStage only

**Participation in Compact State:**
- Logo: ❌ No
- Actions: ❌ No
- Center: ✅ Yes

## Result

Clean, professional header transition that:
- Matches Airbnb's behavior
- Eliminates flicker
- Maintains stable anchors
- Uses proper grid architecture
- Implements hysteresis
- Provides smooth animations
