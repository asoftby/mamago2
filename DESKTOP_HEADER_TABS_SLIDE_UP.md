# Desktop Header Tabs Slide Up Transition

## Overview
Modified intent tabs to smoothly slide upward and fade out during compact transition, creating a cleaner Airbnb-style premium experience.

## Problem Solved
Previously, tabs were using scale animation (`scale-100` → `scale-95`) which felt less premium. The new upward slide creates a more natural "collapsing" effect where tabs appear to move out of view.

## New Transition Behavior

### Full → Compact (Scroll Down)

**Intent Tabs:**
```
Visible → Slide Up & Fade Out
- opacity: 1 → 0
- translateY: 0 → -32px (upward)
- pointer-events: auto → none
```

**Compact Search:**
```
Hidden Below → Slide Up & Fade In
- opacity: 0 → 1
- translateY: 16px → 0 (upward from below)
- pointer-events: none → auto
```

**Visual Effect:**
1. Tabs slide upward and disappear
2. Compact search slides up from below and appears
3. Creates smooth "passing" transition
4. Header height collapses 260px → 100px

### Compact → Full (Scroll Up)

**Compact Search:**
```
Visible → Slide Down & Fade Out
- opacity: 1 → 0
- translateY: 0 → 16px (downward)
- pointer-events: auto → none
```

**Intent Tabs:**
```
Hidden Above → Slide Down & Fade In
- opacity: 0 → 1
- translateY: -32px → 0 (downward from above)
- pointer-events: none → auto
```

**Visual Effect:**
1. Compact search slides down and disappears
2. Tabs slide down from above and appear
3. Creates smooth "expanding" transition
4. Header height expands 100px → 260px

## Code Implementation

### Intent Tabs Container
```tsx
{/* Intent Tabs - Slide up and fade out in compact state */}
<div 
  className={cn(
    "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-out",
    showFull 
      ? "opacity-100 translate-y-0 pointer-events-auto"      // Visible
      : "opacity-0 -translate-y-8 pointer-events-none"       // Hidden above
  )}
>
  <DiscoveryIntentTabs 
    city={currentCity} 
    currentIntent={currentIntent}
  />
</div>
```

**Key Properties:**
- `absolute inset-0`: Positioned absolutely within center column
- `transition-[opacity,transform]`: Animates opacity and translateY
- `duration-300 ease-out`: 300ms smooth easing
- `-translate-y-8`: Moves 32px upward when hidden (Tailwind: 1 unit = 4px)
- `pointer-events-none`: Prevents interaction when hidden

### Compact Search Container
```tsx
{/* Compact Search - Fade in and slide up from below in compact state */}
<div 
  className={cn(
    "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-out",
    showCompact 
      ? "opacity-100 translate-y-0 pointer-events-auto"      // Visible
      : "opacity-0 translate-y-4 pointer-events-none"        // Hidden below
  )}
>
  <div className="w-full max-w-[600px] flex items-center gap-3">
    <DesktopSearchControl isCompact={true} />
    {shouldShowFilters && <RefinementFiltersButtonCompact />}
  </div>
</div>
```

**Key Properties:**
- `absolute inset-0`: Positioned absolutely within center column
- `transition-[opacity,transform]`: Animates opacity and translateY
- `duration-300 ease-out`: 300ms smooth easing
- `translate-y-4`: Moves 16px downward when hidden (Tailwind: 1 unit = 4px)
- `pointer-events-none`: Prevents interaction when hidden

## Why This Feels More Premium

### 1. Directional Movement
**Before (Scale):**
- Tabs shrink toward center
- No clear direction
- Feels like "collapsing inward"

**After (Slide Up):**
- Tabs move upward out of view
- Clear directional flow
- Feels like "sliding away"

### 2. Natural Physics
**Before:**
- Scale animation feels artificial
- No sense of space or depth

**After:**
- Upward movement suggests layers
- Tabs appear to move "behind" header
- More natural spatial relationship

### 3. Airbnb-Style Transition
**Airbnb Pattern:**
- Elements slide in/out of view
- Clear directional transitions
- Smooth opacity + transform

**Our Implementation:**
- Tabs slide up (out of view)
- Search slides up (into view)
- Matches Airbnb's approach

### 4. Cleaner Visual Flow
**Before:**
- Scale creates visual "shrinking"
- Can feel jarring

**After:**
- Slide creates visual "movement"
- Feels more intentional and smooth

## Technical Details

### Transform Values

**Tabs (Full → Compact):**
- Start: `translate-y-0` (0px)
- End: `-translate-y-8` (-32px upward)
- Distance: 32px upward

**Compact Search (Compact → Full):**
- Start: `translate-y-4` (16px downward)
- End: `translate-y-0` (0px)
- Distance: 16px upward

**Why Different Distances:**
- Tabs move further (-32px) to clearly exit view
- Search moves less (16px) for subtle entrance
- Creates asymmetric but balanced transition

### Absolute Positioning

Both elements use `absolute inset-0` within the center column:

```tsx
<div className="relative flex items-center justify-center min-h-[60px]">
  {/* Tabs - absolute positioned */}
  <div className="absolute inset-0">...</div>
  
  {/* Search - absolute positioned */}
  <div className="absolute inset-0">...</div>
</div>
```

**Benefits:**
- Elements can overlap during transition
- No layout shift or reflow
- Smooth crossfade effect
- Parent maintains stable height

### Pointer Events

Critical for interaction management:

```tsx
showFull 
  ? "pointer-events-auto"   // Tabs clickable
  : "pointer-events-none"   // Tabs not clickable

showCompact 
  ? "pointer-events-auto"   // Search clickable
  : "pointer-events-none"   // Search not clickable
```

**Why Important:**
- Prevents clicking hidden elements
- Ensures only visible element is interactive
- No z-index conflicts

## Layout Flow Participation

### Tabs in Compact State

**Question:** Do tabs participate in layout flow when hidden?

**Answer:** No

**Reason:**
- Tabs use `absolute` positioning
- Parent container has fixed `min-h-[60px]`
- Hidden tabs don't affect layout calculation
- Only opacity and transform change

**Layout Impact:**
```
Full State:
- Center column height: 60px (min-h)
- Tabs visible at translateY(0)
- Layout: stable

Compact State:
- Center column height: 60px (min-h) - SAME
- Tabs hidden at translateY(-32px)
- Layout: stable - NO CHANGE
```

### No Reflow

**Before (if using display:none):**
1. Tabs removed from DOM flow
2. Browser recalculates layout
3. Other elements shift
4. Causes reflow/repaint

**After (absolute + opacity):**
1. Tabs stay in DOM
2. Only opacity/transform change
3. No layout recalculation needed
4. GPU-accelerated animation
5. No reflow

## Flicker Reduction

### Why This Reduces Flicker

**1. GPU Acceleration:**
- `opacity` and `transform` are GPU-accelerated
- Browser uses compositor thread
- No main thread blocking

**2. No Layout Thrashing:**
- Absolute positioning removes from flow
- No layout recalculation
- No cascade effects

**3. Stable Container:**
- Parent maintains `min-h-[60px]`
- Height never changes
- No content jump

**4. Smooth Crossfade:**
- Tabs fade out while moving up
- Search fades in while moving up
- Overlapping transitions feel seamless

**5. Stable Anchors:**
- Logo doesn't move
- Actions don't move
- Only center content animates

## Comparison

### Before (Scale Animation)
```tsx
showFull 
  ? "opacity-100 scale-100"
  : "opacity-0 scale-95"
```

**Issues:**
- Scale feels artificial
- No directional flow
- Less premium feel

### After (Slide Up Animation)
```tsx
showFull 
  ? "opacity-100 translate-y-0"
  : "opacity-0 -translate-y-8"
```

**Benefits:**
- Natural upward movement
- Clear directional flow
- Premium Airbnb-style feel
- Better spatial awareness

## Summary

**Container Responsible for Tabs:**
- Center column with `relative` positioning
- Tabs inside with `absolute inset-0`

**How Tabs Exit:**
- Opacity: 1 → 0 (fade out)
- TranslateY: 0 → -32px (slide up)
- Pointer-events: auto → none (disable interaction)

**Layout Flow Participation:**
- Full state: No (absolute positioned)
- Compact state: No (absolute positioned)
- Never participates in layout flow
- Parent maintains stable height

**Flicker Reduction:**
- ✅ GPU-accelerated transforms
- ✅ No layout recalculation
- ✅ No reflow
- ✅ Stable container height
- ✅ Smooth crossfade
- ✅ Stable anchor elements

**Result:**
Cleaner, more premium transition that feels closer to Airbnb's polished header behavior.
