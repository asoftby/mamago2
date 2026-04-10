# Mobile Plan UI Refinement - Complete ✅

## Overview
Refined the mobile/sheet view of "Мой план" to create a more premium, cohesive visual hierarchy inspired by Yandex Afisha's clean design approach.

## Changes Made

### 1. Month Label - Cleaner, More Human Style ✅

**Before**:
- "МАРТ - АПРЕЛЬ 2026"
- ALL CAPS with letter-spacing
- Double month format with dash
- Small, technical, system-like appearance
- `text-xs font-semibold tracking-[0.12em] text-neutral-400`

**After**:
- "Апрель" or "Апрель 2026" (shows year only if not current year)
- Normal case, capitalized first letter
- Single month based on selected date
- Larger, more prominent, editorial style
- `text-base font-semibold text-neutral-700` (compact mode)
- `text-sm font-semibold text-neutral-700` (desktop mode)

**Logic Changes**:
```typescript
// New function signature with selectedDate parameter
buildWeekMonthLabel(weekDays: string[], selectedDate?: string): string

// Uses selected date as reference, not week range
// Shows single month, not "МАРТ - АПРЕЛЬ"
// Capitalizes first letter: "Апрель"
// Shows year only if different from current year
```

### 2. Audience Button - Same Height as CTA ✅

**Before**:
- Small, thin button: `px-3 py-2`
- Looked like secondary metadata, not a control
- Icon: `h-4 w-4`
- No disclosure indicator

**After**:
- Full-height control: `px-4 py-3.5`
- Same visual weight as "Собрать день автоматически" CTA
- Larger icon: `h-5 w-5`
- Added chevron disclosure indicator on right
- Full width with proper spacing
- Rounded: `rounded-2xl` (matches CTA)

**Visual Hierarchy**:
```typescript
// Compact mobile variant
<button className="flex w-full items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-sm font-medium text-neutral-700">
  <div className="flex items-center gap-2.5">
    <Users className="h-5 w-5" />
    <span>{label}</span>
  </div>
  <ChevronRight className="h-4 w-4" />
</button>
```

### 3. Mobile Layout Reordering ✅

**New Order**:
1. Header with day name and location
2. Calendar strip (with improved month label)
3. Audience control ("Для Таи и Степана")
4. Add child banner (if no children)
5. Auto-fill CTA ("Собрать день автоматически")
6. Time period slots (Morning, Afternoon, Evening)
7. Ideas section

**Spacing**:
- Changed main container from `space-y-6` to `space-y-5`
- Changed padding from `py-4` to `py-5`
- Consistent 5-unit rhythm throughout

### 4. Visual Cohesion Improvements ✅

**Typography**:
- Month label: larger, more prominent, normal case
- Audience button: proper height, clear affordance
- Consistent font weights and sizes

**Spacing**:
- Unified vertical rhythm (5-unit spacing)
- Audience and CTA feel like a control zone
- Calendar strip feels like a natural heading

**Colors**:
- Month: `text-neutral-700` (was `text-neutral-400`)
- More readable, less "system-like"
- Premium, editorial feel

## Files Modified

### 1. `src/features/my-plan/lib/weekCalendar.ts`
- Updated `buildWeekMonthLabel()` function
- Added `selectedDate` parameter
- Changed from range format to single month
- Removed uppercase transformation
- Added year logic (show only if not current year)

### 2. `src/features/my-plan/components/WeekCalendarStrip.tsx`
- Pass `selectedDate` to `buildWeekMonthLabel()`
- Updated month label styles:
  - Removed `tracking-[0.12em]` (letter-spacing)
  - Changed from `text-xs` to `text-base` (compact) / `text-sm` (desktop)
  - Changed from `text-neutral-400` to `text-neutral-700`
  - Removed uppercase

### 3. `src/features/my-plan/components/PlanAudienceCompact.tsx`
- Increased compact button height: `py-2` → `py-3.5`
- Increased padding: `px-3` → `px-4`
- Changed border radius: `rounded-lg` → `rounded-2xl`
- Increased icon size: `h-4 w-4` → `h-5 w-5`
- Added chevron disclosure indicator
- Added `justify-between` layout
- Improved internal spacing: `gap-2` → `gap-2.5`

### 4. `src/features/my-plan/components/PlanMainContent.tsx`
- Reordered mobile layout elements
- Moved audience block before auto-fill CTA
- Removed extra wrapper div
- Changed spacing: `space-y-6` → `space-y-5`
- Changed padding: `py-4` → `py-5`
- Removed `order-1` and `order-2` classes (no longer needed)

## Visual Comparison

### Before
```
Header
─────────────
Calendar: МАРТ - АПРЕЛЬ 2026 (tiny, caps, technical)
─────────────
[thin audience button]
[banner]
[CTA - tall and prominent]
Slots...
```

### After
```
Header
─────────────
Calendar: Апрель (clean, readable, prominent)
─────────────
[Audience control - same height as CTA ▸]
[banner]
[CTA - tall and prominent]
Slots...
```

## Design Principles Applied

1. **Yandex Afisha Style**:
   - Clean, editorial typography
   - No unnecessary uppercase
   - Prominent but calm month labels
   - Human-readable formats

2. **Visual Hierarchy**:
   - Month label is a calm heading, not system metadata
   - Audience and CTA are in same visual class
   - Controls feel like controls, not thin metadata lines

3. **Premium Mobile UI**:
   - Consistent vertical rhythm
   - Proper touch targets (44pt+)
   - Clear affordances (chevron indicator)
   - Unified spacing system

4. **Simplicity**:
   - Single month, not range
   - No letter-spacing noise
   - Larger, more readable text
   - Less visual clutter

## Acceptance Criteria

- [x] Audience button has same height as "Собрать день автоматически"
- [x] Audience button looks like a full control, not a thin line
- [x] Entire audience button is clickable
- [x] Opens PlanAudienceSheet on click
- [x] Month label no longer shows "МАРТ - АПРЕЛЬ 2026"
- [x] Month label uses cleaner format: "Апрель" or "Апрель 2026"
- [x] Month label is more prominent and readable
- [x] Top of screen feels more cohesive and premium
- [x] No broken synchronization (audience/date/plan)
- [x] No TypeScript errors
- [x] No React warnings

## Testing Notes

**Test Cases**:
1. Month display in same month: should show "Апрель"
2. Month display in different year: should show "Апрель 2025"
3. Week crossing two months: should show month of selected date
4. Audience button height: should match CTA height visually
5. Audience button click: should open sheet
6. Chevron indicator: should be visible on right side
7. Mobile spacing: should feel unified and premium

**Browser Testing**:
- Mobile Safari (iOS)
- Chrome Mobile (Android)
- Desktop responsive view

---

**Status**: Implementation complete, ready for visual testing
**Date**: 2026-04-04
**Task**: Mobile Plan UI Refinement - Yandex Afisha Style
