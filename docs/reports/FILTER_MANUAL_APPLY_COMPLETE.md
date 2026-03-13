# Filter Manual Apply with Inline Clear Buttons - Complete

## Overview
Changed filter UX from automatic real-time application to manual apply model with inline clear buttons on each selected field (Airbnb-style) and a Go button.

## Changes Made

### 1. Desktop Search Control (`src/components/site/header/DesktopSearchControl.tsx`)
  
- **Go Button**: Added to the RIGHT side of the search control
  - Always visible in full (expanded) state
  - Orange background (#EF8759)
  - Applies draft filters to URL when clicked
  - Label: "Go"

- **Inline Clear Buttons**: Added to each filter segment
  - Appears on hover when that segment has active filters
  - Small circular button (5x5) with X icon (3x3)
  - Gray background (bg-gray-200) with hover effect (bg-gray-300)
  - Positioned on the right side of each segment
  - Clears only that segment's filters
  - Stops event propagation to prevent opening the panel

- **Draft State Display**: 
  - When panels are open, displays draft filter values (not yet applied)
  - When panels are closed, displays applied filter values from URL
  - Provides visual feedback of selections before applying

- **Panel Behavior**:
  - Opening a panel initializes draft from current applied filters
  - Closing a panel (clicking outside) reverts draft without applying
  - Pressing Escape reverts draft and closes panel
  - Clicking Go applies draft to URL and closes panels
  - Clicking inline X clears that segment's draft filters

### 2. Inline Clear Button Design
Each segment (Location, Date, Age) has:
- **Hover-activated clear button**
  - Only visible on hover (`opacity-0 group-hover:opacity-100`)
  - Only shown when segment has active filters
  - Compact 5x5 button size with 3x3 X icon
  - Gray background with smooth hover transition
  - Positioned at the right edge of the segment
  - Uses `stopPropagation()` to prevent panel opening

### 3. Filter Segments Updated
- **Location Segment**: 
  - Shows X when: nearby, metro, or district is selected
  - Clears: nearby, metro, district
  
- **Date Segment**: 
  - Shows X when: dateFrom, dateTo, or whenPreset is set
  - Clears: dateFrom, dateTo, whenPreset
  
- **Age Segment**: 
  - Shows X when: age array has items
  - Clears: age array

### 4. Filter Panels (Location, Date, Age)
- **Removed**: Header clear buttons
- Panels are now clean with just content
- All clearing happens via inline buttons in the main form

### 5. Filter Store (`src/features/filters/discovery/filters.store.ts`)
- **Draft State Management**:
  - Added `draft` state separate from `applied` (URL-based) state
  - Draft syncs with applied when URL changes (but not while editing)
  - `beginDraft(key)` - Initializes draft from applied before opening panel
  - `setDraft(patch)` - Updates draft state without touching URL
  - `actions.apply()` - Writes draft to URL
  - `actions.close()` - Reverts draft to applied state

- **Actions Updated**:
  - `apply()` - Applies draft filters to URL
  - `setDraft(patch)` - Updates draft state
  - `resetAll()` - Clears all filters in URL and draft
  - `close()` - Reverts draft to applied state

### 6. Mobile Search Sheet (`src/components/mobile/MobileSearchSheet.tsx`)
- Already had manual apply pattern with "Показать" button
- No changes needed - continues to work as before

## User Flow

### Desktop
1. User clicks on a filter segment (Location, Date, or Age)
2. Panel opens with current applied values
3. User makes selections - sees changes in the segment display (draft state)
4. On hover over a segment with filters, X button appears
5. User can:
   - Click X on any segment to clear that specific filter (updates draft)
   - Click "Go" to apply all draft filters and trigger search
   - Click outside or press Escape to cancel and revert all changes
   - Open another segment to continue editing (draft persists)

### Mobile
- Unchanged - already had manual apply with "Показать" button

## Design Details

### Inline Clear Button Style
```tsx
{hasLocationFilter && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClearLocation();
    }}
    className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
    aria-label="Очистить местоположение"
  >
    <X className="h-3 w-3 text-gray-600" />
  </button>
)}
```

- Compact 5x5 button size
- 3x3 X icon from lucide-react
- Gray background (200) → darker gray (300) on hover
- Smooth opacity transition (0 → 100 on group hover)
- Stops event propagation to prevent panel opening
- Accessible with aria-label

### Segment Layout with Clear Button
```tsx
<button className="... relative group">
  <Icon />
  <div className="flex flex-col ...">
    <span>Label</span>
    <span>Value</span>
  </div>
  {hasFilter && (
    <button onClick={handleClear}>X</button>
  )}
</button>
```

## Technical Details

### State Flow
```
URL (applied) → Draft (editing) → URL (applied)
     ↑                                  ↓
     └──────────── Go button ───────────┘
```

### Key Behaviors
- Draft is initialized from applied when opening any panel
- Draft persists across panel switches (can edit multiple filters)
- Draft is reverted when closing without applying
- Applied filters (from URL) are always the source of truth
- Display shows draft when editing, applied when not editing
- Each segment can clear its own filters independently via inline X
- Inline X buttons update draft state, not URL directly

## Files Modified
1. `src/components/site/header/DesktopSearchControl.tsx`
2. `src/features/filters/discovery/filters.store.ts`
3. `src/components/site/header/search-segments/filterUtils.ts`
4. `src/components/site/header/search-segments/LocationPanel.tsx`
5. `src/components/site/header/search-segments/DatePanel.tsx`
6. `src/components/site/header/search-segments/AgePanel.tsx`

## Testing Checklist
- [x] Removed clear buttons from panel headers
- [x] Inline X button appears on hover for each segment with filters
- [x] X button in Location segment clears location filters
- [x] X button in Date segment clears date filters
- [x] X button in Age segment clears age filters
- [x] X button doesn't open the panel (stopPropagation works)
- [ ] Go button applies draft filters to URL
- [ ] Opening panel shows current applied values
- [ ] Making selections updates display (draft)
- [ ] Clicking outside reverts changes
- [ ] Pressing Escape reverts changes
- [ ] Can edit multiple filters before applying
- [ ] Applied filters persist in URL
- [ ] Mobile search sheet still works correctly

## Status
✅ Implementation complete
✅ No TypeScript errors
✅ Ready for testing
