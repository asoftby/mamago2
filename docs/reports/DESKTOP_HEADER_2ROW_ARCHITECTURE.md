# Desktop Header 2-Row Architecture (Airbnb-Style)

## Overview
Restructured desktop header to use proper 2-row layout in full state and 1-row in compact state, matching Airbnb's design pattern.

## Architecture

### FULL STATE (2 Rows)
```
┌─────────────────────────────────────────────────────────────┐
│ Row 1: [Logo + Search Icon] [Intent Tabs] [Heart + Profile] │
│                                                               │
│ Row 2:        [Full Search Form with 3 segments]            │
└─────────────────────────────────────────────────────────────┘
Height: 260px
```

**Row 1 Structure:**
- Left column (1fr): Logo + Global Search button
- Center column (2fr): Intent Tabs (Куда, Занятия, День рождения, Маршруты)
- Right column (1fr): Favorites + Profile buttons

**Row 2 Structure:**
- Left column (1fr): Empty (for alignment)
- Center column (2fr): Full search form (Location | Date | Age segments)
- Right column (1fr): Empty (for alignment)

### COMPACT STATE (1 Row)
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo + Search Icon] [Compact Search + Filters] [Heart + Profile] │
└─────────────────────────────────────────────────────────────┘
Height: 100px
```

**Single Row Structure:**
- Left column (1fr): Logo + Global Search button
- Center column (2fr): Compact search summary + Filters button
- Right column (1fr): Favorites + Profile buttons

## Key Implementation Details

### 1. Grid-Based Layout
Using CSS Grid instead of flexbox for precise row control:
```tsx
<div className={cn(
  "grid transition-all duration-300 ease-out",
  showFull 
    ? "grid-rows-[auto_auto] gap-y-6 pt-8 pb-6"  // 2 rows
    : "grid-rows-1 gap-y-0 pt-6 pb-6"            // 1 row
)}>
```

### 2. Search Form Migration
The search form physically moves between rows:

**Full State:**
- Search form lives in Row 2 (center column)
- Rendered as full 3-segment form
- Intent tabs visible in Row 1

**Compact State:**
- Search form moves to Row 1 (center column)
- Rendered as compact summary button
- Intent tabs hidden with opacity/scale transition

### 3. Smooth Transitions

**Intent Tabs (Row 1 Center):**
```tsx
<div className={cn(
  "transition-[opacity,transform] duration-300 ease-out",
  showFull 
    ? "opacity-100 scale-100 pointer-events-auto" 
    : "opacity-0 scale-95 pointer-events-none absolute"
)}>
```

**Compact Search (Row 1 Center):**
```tsx
<div className={cn(
  "transition-[opacity,transform] duration-300 ease-out",
  showCompact 
    ? "opacity-100 scale-100 pointer-events-auto" 
    : "opacity-0 scale-95 pointer-events-none absolute"
)}>
```

**Full Search Form (Row 2):**
```tsx
<div className={cn(
  "transition-[opacity,transform,max-height] duration-300 ease-out",
  showFull 
    ? "opacity-100 translate-y-0 max-h-[100px]" 
    : "opacity-0 -translate-y-4 max-h-0 pointer-events-none"
)}>
```

### 4. Anchor Elements
Logo and action buttons remain stable in both states:
- Logo: 60px (full) → 48px (compact)
- Action buttons: 15px (full) → 12px (compact)
- Icons: 7px (full) → 6px (compact)

### 5. No Mount/Unmount
Both search states exist in DOM simultaneously:
- Full search form always rendered in Row 2
- Compact search always rendered in Row 1 center
- Visibility controlled via opacity + pointer-events
- Position controlled via absolute positioning when hidden

## Why This Matches Airbnb

### 1. True 2-Row → 1-Row Collapse
- Full header has distinct navigation row + search row
- Compact header consolidates everything into single row
- Height reduction is significant and noticeable

### 2. Search Form Migration
- Search physically moves from bottom to center
- Not just resizing in place
- Creates sense of "collapsing up"

### 3. Smooth Visual Flow
- Intent tabs fade out gracefully
- Compact search fades in at same position
- No jarring layout shifts or flicker

### 4. Proper Grid Structure
- Columns maintain consistent proportions
- Center content always centered
- Side elements always aligned

## Transition Behavior

### Scroll Down (Full → Compact):
1. User scrolls past 20px threshold
2. Row 2 fades out (opacity + translateY)
3. Intent tabs fade out (opacity + scale)
4. Compact search fades in (opacity + scale)
5. Header height animates 260px → 100px
6. Logo and buttons scale down

### Scroll Up (Compact → Full):
1. User scrolls above 10px threshold (hysteresis)
2. Compact search fades out
3. Intent tabs fade in
4. Row 2 fades in
5. Header height animates 100px → 260px
6. Logo and buttons scale up

## Technical Benefits

### 1. No Flicker
- Grid layout prevents layout shift
- Opacity transitions are GPU-accelerated
- Transform animations don't trigger reflow

### 2. Hysteresis Prevents Jitter
- Enter compact at 20px
- Exit compact at 10px
- State doesn't oscillate at boundary

### 3. Maintainable Structure
- Clear separation of rows
- Easy to understand layout
- Simple to modify individual sections

### 4. Performance
- Single outer container height change
- All inner transitions use opacity/transform
- No expensive layout recalculations

## Files Modified

1. `src/components/site/header/SiteHeader.desktop.tsx`
   - Restructured to grid-based 2-row layout
   - Added row-specific rendering logic
   - Implemented smooth row collapse

2. `src/components/site/header/DesktopSearchControl.tsx`
   - Simplified to render single state based on prop
   - Removed internal state switching
   - Cleaner conditional rendering

3. `src/hooks/useHeaderScrolled.ts`
   - Already had hysteresis implementation
   - No changes needed

## Result

The desktop header now behaves like Airbnb:
- Professional 2-row full state with clear hierarchy
- Compact 1-row sticky state that's truly smaller
- Smooth, flicker-free transitions
- Search form visibly migrates between rows
- Intent tabs gracefully disappear/reappear
