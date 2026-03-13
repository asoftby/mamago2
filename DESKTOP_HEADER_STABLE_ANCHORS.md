# Desktop Header Stable Anchor Architecture

## Overview
Refactored desktop header to ensure logo and action icons are completely stable anchor elements that never participate in compact/full transitions. Only the center column animates.

## Problem Solved
Previously, logo and action icons were being animated (scale, size changes) during compact/full transitions, causing unnecessary re-renders and contributing to perceived flicker.

## New Architecture

### Three-Column Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [STABLE LEFT]    [ANIMATED CENTER]    [STABLE RIGHT]        │
└─────────────────────────────────────────────────────────────┘
```

### Column Definitions

#### LEFT COLUMN - STABLE ANCHOR
**Elements:**
- Logo (60px height - FIXED)
- Global Search button (60px × 60px - FIXED)

**Properties:**
- No size changes
- No scale animations
- No opacity transitions
- No layout recalculations
- Fixed width: auto (based on content)
- Grid column: `auto` (content-sized)

**CSS:**
```tsx
<div className="flex items-center gap-3">
  <Image className="w-auto h-[60px]" /> {/* FIXED HEIGHT */}
  <Link className="w-[60px] h-[60px]" /> {/* FIXED SIZE */}
</div>
```

#### CENTER COLUMN - ANIMATED
**Elements:**
- Intent Tabs (full state)
- Compact Search (compact state)
- Full Search Form (row 2, full state)

**Properties:**
- Opacity transitions
- Scale transitions
- Transform transitions
- Absolute positioning for overlapping states
- Grid column: `1fr` (flexible)

**CSS:**
```tsx
<div className="relative flex items-center justify-center min-h-[60px]">
  {/* Tabs and compact search absolutely positioned */}
  <div className="absolute inset-0 transition-[opacity,transform]">
    {/* Content */}
  </div>
</div>
```

#### RIGHT COLUMN - STABLE ANCHOR
**Elements:**
- Favorites button (60px × 60px - FIXED)
- Profile button (60px × 60px - FIXED)

**Properties:**
- No size changes
- No scale animations
- No opacity transitions
- No layout recalculations
- Fixed width: auto (based on content)
- Grid column: `auto` (content-sized)

**CSS:**
```tsx
<div className="flex items-center gap-3">
  <Link className="w-[60px] h-[60px]" /> {/* FIXED SIZE */}
  <Link className="w-[60px] h-[60px]" /> {/* FIXED SIZE */}
</div>
```

## Grid Layout

### Row 1 (Always Visible)
```tsx
<div className="grid grid-cols-[auto_1fr_auto] items-center gap-6">
  <div>{/* STABLE LEFT */}</div>
  <div>{/* ANIMATED CENTER */}</div>
  <div>{/* STABLE RIGHT */}</div>
</div>
```

**Column sizing:**
- `auto`: Left column sizes to content (logo + button)
- `1fr`: Center column takes remaining space
- `auto`: Right column sizes to content (2 buttons)

### Row 2 (Full State Only)
```tsx
<div className="grid grid-cols-[auto_1fr_auto] items-center gap-6">
  <div className="w-[123px]">{/* Empty spacer matching left width */}</div>
  <div>{/* ANIMATED CENTER - Full Search */}</div>
  <div className="w-[123px]">{/* Empty spacer matching right width */}</div>
</div>
```

**Alignment:**
- Empty spacers (123px) match the width of logo+button and action buttons
- Ensures Row 2 search form aligns with Row 1 center column

## What Changed

### BEFORE (Problematic)
```tsx
// Logo with animated height
<Image className={cn(
  "transition-[height] duration-300",
  showCompact ? "h-[48px]" : "h-[60px]"
)} />

// Buttons with animated size
<Link className={cn(
  "transition-all duration-200",
  showCompact ? "w-12 h-12" : "w-15 h-15"
)}>
  <Icon className={cn(
    "transition-all duration-300",
    showCompact ? "h-6 w-6" : "h-7 w-7"
  )} />
</Link>
```

**Issues:**
- Logo height changed: 60px → 48px
- Button size changed: 60px → 48px
- Icon size changed: 28px → 24px
- All elements had transition classes
- Browser recalculated layout for anchors
- Unnecessary re-renders on scroll state change

### AFTER (Stable)
```tsx
// Logo with fixed height
<Image className="w-auto h-[60px]" />

// Buttons with fixed size
<Link className="w-[60px] h-[60px]">
  <Icon className="h-7 w-7" />
</Link>
```

**Benefits:**
- Logo always 60px
- Buttons always 60px × 60px
- Icons always 28px
- No transition classes on anchors
- No layout recalculation
- No re-render on scroll state change

## Transition Behavior

### What Animates (Center Column Only)

**Full → Compact:**
1. Intent Tabs fade out (opacity + scale)
2. Compact Search fades in (opacity + scale)
3. Row 2 Full Search fades out (opacity + translateY)
4. Header height: 260px → 100px

**Compact → Full:**
1. Compact Search fades out (opacity + scale)
2. Intent Tabs fade in (opacity + scale)
3. Row 2 Full Search fades in (opacity + translateY)
4. Header height: 100px → 260px

### What Doesn't Animate (Anchors)

**Logo:**
- ✅ Always 60px height
- ✅ Always same position
- ✅ No transitions
- ✅ No re-render

**Action Buttons:**
- ✅ Always 60px × 60px
- ✅ Always same position
- ✅ No transitions
- ✅ No re-render

**Icons:**
- ✅ Always 28px
- ✅ No scale changes
- ✅ No transitions

## Performance Benefits

### 1. Reduced Layout Thrashing
- Anchor elements don't trigger layout recalculation
- Browser only recalculates center column
- Fewer paint operations

### 2. No Unnecessary Re-renders
- Logo component doesn't re-render on scroll state
- Action button components don't re-render on scroll state
- Only center column components re-render

### 3. Simpler Transition Logic
- No conditional classes on anchors
- No size interpolation calculations
- Cleaner animation timeline

### 4. Visual Stability
- User's eye can anchor to logo/actions
- No perceived movement of stable elements
- Smoother overall experience

## Why This Reduces Flicker

### Before
1. Scroll state changes
2. Logo re-renders with new size
3. Buttons re-render with new size
4. Icons re-render with new size
5. Center content re-renders
6. Browser recalculates entire row layout
7. Multiple paint operations
8. **Result: Visible flicker**

### After
1. Scroll state changes
2. Logo stays same (no re-render)
3. Buttons stay same (no re-render)
4. Icons stay same (no re-render)
5. Only center content re-renders
6. Browser only recalculates center column
7. Single paint operation for center
8. **Result: Smooth transition**

## Code Structure

### Stable Left Anchor
```tsx
{/* LEFT: Logo + Global Search Button - STABLE ANCHOR */}
<div className="flex items-center gap-3">
  <Link href="/minsk" className="hover:opacity-80 transition-opacity">
    <Image
      src="/favico_mamago.webp"
      alt="MamaGo"
      width={100}
      height={100}
      priority
      className="w-auto h-[60px]" // FIXED - no transitions
    />
  </Link>
  
  <Link
    href="/minsk"
    className="flex items-center justify-center w-[60px] h-[60px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
    aria-label="Глобальный поиск"
  >
    <Search className="h-7 w-7 text-gray-600" /> // FIXED - no transitions
  </Link>
</div>
```

### Animated Center
```tsx
{/* CENTER: Intent Tabs (full) OR Compact Search (compact) - ANIMATED */}
<div className="relative flex items-center justify-center min-h-[60px]">
  {/* Intent Tabs - Only visible in full state */}
  <div 
    className={cn(
      "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-out",
      showFull 
        ? "opacity-100 scale-100 pointer-events-auto" 
        : "opacity-0 scale-95 pointer-events-none"
    )}
  >
    <DiscoveryIntentTabs />
  </div>

  {/* Compact Search - Only visible in compact state */}
  <div 
    className={cn(
      "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-out",
      showCompact 
        ? "opacity-100 scale-100 pointer-events-auto" 
        : "opacity-0 scale-95 pointer-events-none"
    )}
  >
    <DesktopSearchControl isCompact={true} />
  </div>
</div>
```

### Stable Right Anchor
```tsx
{/* RIGHT: Profile Actions - STABLE ANCHOR */}
<div className="flex items-center gap-3">
  <Link
    href="/me"
    className="flex items-center justify-center w-[60px] h-[60px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
    aria-label="Избранное"
  >
    <Heart className="h-7 w-7 text-gray-600" /> // FIXED - no transitions
  </Link>
  
  <Link
    href="/me/profile"
    className="flex items-center justify-center w-[60px] h-[60px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
    aria-label="Профіль"
  >
    <User className="h-7 w-7 text-gray-600" /> // FIXED - no transitions
  </Link>
</div>
```

## Summary

**Stable Containers:**
- Left column: Logo + Global Search (123px total width)
- Right column: Favorites + Profile (123px total width)

**Animated Container:**
- Center column: Tabs ↔ Compact Search (Row 1) + Full Search (Row 2)

**Participation in Compact State:**
- Logo: ❌ No
- Action Icons: ❌ No
- Center Content: ✅ Yes

**Result:**
- Cleaner transitions
- Better performance
- Less flicker
- More stable visual experience
- Matches Airbnb's approach
