# PlanCard 2.0 - Premium Week Strip Complete

## Overview
Successfully upgraded PlanCard to premium UX with interactive week strip, day pills, and mini-cards. The component now feels polished and production-ready while maintaining clean architecture.

## Implementation

### Component Structure
Created modular subcomponents within `PlanCard.tsx`:

1. **DayPill** - Individual day button
   - Uppercase weekday label (ПН, ВТ, СР...)
   - Day number
   - Today indicator (small dot in top-right)
   - Item indicator (small dot at bottom)
   - Selected state (filled with primary color)
   - Hover state
   - Focus-visible ring for accessibility
   - `aria-pressed` for screen readers

2. **WeekStrip** - 7-day grid
   - Responsive grid layout
   - Maps over weekDates
   - Handles selection state
   - Passes click handlers to pills

3. **PlanItemMiniCard** - Activity preview
   - Square thumbnail (14x14, rounded)
   - Cover image or emoji placeholder (📅)
   - Activity title (line-clamp-2)
   - Time display or "В любое время"
   - Soft surface variant
   - Hover state

4. **DaySection** - Selected day content
   - Day header with weekday + short date
   - "Сценарий →" button (ghost variant, only when items exist)
   - Items list or empty state
   - Footer hint when < 2 items: "Добавьте ещё событие — и мы соберём сценарий дня."
   - Empty state CTA: "Найти событие" → /minsk

### Main PlanCard Component
- Client component (`"use client"`)
- Uses `useState` for selected date
- Defaults to first day with items, or today
- Clean header with title
- Week strip section
- Day section below

## Key Features

### Week Strip
- 7 clickable day pills (Mon-Sun)
- Visual states:
  - **Selected**: Primary background, white text, shadow
  - **Today**: Small dot indicator (top-right)
  - **Has Items**: Small dot indicator (bottom)
  - **Hover**: Muted background
  - **Focus**: Ring outline
- Uppercase weekday labels
- Day numbers
- Fully accessible (keyboard navigation, aria-pressed)

### Day Pills
- Rounded-xl corners
- Smooth transitions
- Clear visual hierarchy
- Touch-friendly sizing (p-3)
- Responsive to interaction

### Mini Cards
- Soft surface variant
- 14x14 thumbnail
- Cover images when available
- Emoji placeholder when no image
- Title with line-clamp
- Time or "В любое время"
- Hover effect

### Empty States
- Friendly messaging
- Clear CTA button
- Centered layout
- Proper spacing

### Footer Hints
- Shows when 1 item exists
- Encourages adding more
- Centered, muted text
- Non-intrusive

### Scenario Button
- Only shows when items exist
- Ghost variant (subtle)
- Links to `/me/day/[date]`
- Primary color text

## UI-LAB Demo

Created comprehensive demo section showing 3 states:

1. **Empty Week**
   - No plan items
   - Shows empty state
   - CTA to find activities

2. **Week with 1 Item**
   - Single item on Wednesday
   - Shows footer hint
   - Demonstrates mini-card

3. **Week with Multiple Items**
   - Items across multiple days
   - Shows item indicators on pills
   - Demonstrates scenario button
   - Multiple mini-cards

## Technical Details

### Client-Side State
- Component is client-side for interactivity
- Uses `useState` for selected date
- No URL query param dependency
- Avoids hydration issues

### Date Formatting
- Uses `formatRuShortDayMonth()` for deterministic dates
- Uppercase weekday names via `toUpperCase()`
- Consistent Russian locale

### Accessibility
- Keyboard navigation supported
- `aria-pressed` on day pills
- Focus-visible rings
- Semantic HTML (buttons, not divs)

### Performance
- No unnecessary re-renders
- Efficient state management
- Memoization not needed (small dataset)

### Type Safety
- Full TypeScript coverage
- Proper prop types
- Prisma-generated types

## UI-LAB Compliance

### Typography
- All text uses Typography components
- H2 for title
- Body for content
- Caption for meta
- BodyMuted for secondary text
- No inline font sizes

### Surfaces
- Elevated variant for main card
- Soft variant for mini-cards
- Consistent padding

### Spacing
- Consistent gaps (gap-2, gap-3)
- Proper vertical spacing (space-y-2, space-y-4)
- No arbitrary values

### Colors
- Uses design tokens (primary, muted, foreground)
- Proper contrast ratios
- Accessible color combinations

### Interactions
- Smooth transitions
- Hover states
- Focus states
- Touch-friendly targets

## Build Status
✅ Build passes with 0 errors
✅ TypeScript compilation clean
✅ All diagnostics clear
✅ No hydration issues
✅ UI-LAB demo working

## Files Created/Modified

### Created:
- `src/features/me/components/PlanCard.tsx` (rewritten)
- `src/app/(ui)/ui-lab/_sections/PlanCardSection.tsx`

### Modified:
- `src/app/(public)/me/page.tsx` - Removed selectedDate prop
- `src/app/(ui)/ui-lab/page.tsx` - Added PlanCardSection

## Design Decisions

### Why Client Component?
- Interactive day selection requires state
- Avoids URL query param complexity
- Better UX (instant feedback)
- No page reloads

### Why No URL Sync?
- Simpler implementation
- Avoids hydration issues
- Week view is ephemeral (not bookmarkable)
- Day scenario page handles deep linking

### Why Emoji Placeholder?
- Lightweight (no image loading)
- Friendly and approachable
- Consistent sizing
- Works without network

### Why Footer Hint?
- Educates users about scenario feature
- Encourages engagement
- Non-intrusive
- Only shows when relevant

### Why Ghost Button for Scenario?
- Subtle, doesn't compete with content
- Consistent with secondary actions
- Primary color maintains visibility
- Proper hierarchy

## Next Steps (Future)

### Enhancements:
- Add swipe gestures for mobile
- Add week navigation (prev/next week)
- Add drag-and-drop reordering
- Add inline time picker
- Add delete button on mini-cards
- Add activity detail modal

### Optimizations:
- Add loading states
- Add optimistic updates
- Add error boundaries
- Add skeleton loaders

### Features:
- Multi-week view
- Month view
- Calendar integration
- Recurring events
- Reminders

## Comparison: Before vs After

### Before:
- Basic Links for days
- Text-only item counts
- Large activity cards
- No visual hierarchy
- No today indicator
- No empty state guidance

### After:
- Interactive button pills
- Visual item indicators
- Compact mini-cards
- Clear visual hierarchy
- Today dot indicator
- Friendly empty states
- Footer hints
- Smooth transitions
- Accessible interactions
- Premium feel

## Success Metrics

✅ Premium visual design
✅ Clear week strip
✅ Clickable day pills
✅ Mini-cards with thumbnails
✅ UI-LAB demo with 3 states
✅ Build passes
✅ No hydration issues
✅ Fully accessible
✅ Type-safe
✅ UI-LAB compliant
