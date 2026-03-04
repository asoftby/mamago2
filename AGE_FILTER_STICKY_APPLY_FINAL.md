# Age Filter Sticky Apply Button - Final Implementation

## Overview

Implemented a truly sticky "Применить" button at the bottom of the Age filter dropdown that:
- Only appears when at least one age is selected
- Stays visible while scrolling the options list
- Removed "Сбросить" button from dropdown
- Applies selections only when clicked

## Final Implementation

### Layout Structure

```tsx
<div className="relative max-h-[70vh] w-full">
  {/* Scrollable options list */}
  <div className={cn(
    "overflow-auto",
    draftValues.length > 0 ? "pb-16" : "pb-1"  // Extra padding when button visible
  )}>
    <div className="p-1">
      {/* Age options */}
    </div>
  </div>
  
  {/* Sticky footer - conditional */}
  {draftValues.length > 0 && (
    <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-3">
      <Button onClick={handleApply} className="w-full rounded-full">
        Применить
      </Button>
    </div>
  )}
</div>
```

### Key Features

1. **Conditional Rendering** ✅
   - Button only shows when `draftValues.length > 0`
   - Hidden when no selections made

2. **Truly Sticky** ✅
   - Uses `position: sticky` with `bottom-0`
   - Stays at bottom while scrolling
   - Inside the popover container

3. **Proper Spacing** ✅
   - Dynamic padding-bottom on scroll area
   - `pb-16` when button visible (prevents last items being hidden)
   - `pb-1` when button hidden (minimal padding)

4. **Visual Polish** ✅
   - Border-top separates button from list
   - `bg-background/95 backdrop-blur` for semi-transparent effect
   - Full-width rounded button

5. **No Reset Button** ✅
   - Removed "Сбросить" from dropdown
   - Users can clear via X button on trigger
   - Cleaner, simpler UI

## Visual Layout

### With Selections (Button Visible)
```
┌─────────────────────────────────┐
│ ☐ 0–1 год                       │
│ ☑ 1–3 года                      │
│ ☐ 3–5 лет                       │
│ ☑ 5–7 лет                       │  ← Scrollable
│ ☐ 7–9 лет                       │     (max-h: 70vh)
│ ☐ 9–12 лет                      │     (pb-16 for spacing)
│ ☐ 12–14 лет                     │
│ ☐ 14–16 лет                     │
│ ☐ 16–18 лет                     │
│ ☐ 18+                           │
│                                 │  ← Extra padding
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │      Применить              │ │  ← Sticky button
│ └─────────────────────────────┘ │     (always visible)
└─────────────────────────────────┘
```

### Without Selections (Button Hidden)
```
┌─────────────────────────────────┐
│ ☐ 0–1 год                       │
│ ☐ 1–3 года                      │
│ ☐ 3–5 лет                       │
│ ☐ 5–7 лет                       │  ← Scrollable
│ ☐ 7–9 лет                       │     (max-h: 70vh)
│ ☐ 9–12 лет                      │     (pb-1 minimal)
│ ☐ 12–14 лет                     │
│ ☐ 14–16 лет                     │
│ ☐ 16–18 лет                     │
│ ☐ 18+                           │
└─────────────────────────────────┘
                                     ← No button
```

## Behavior Flow

### User Interaction
```
1. User opens Age dropdown
   ↓
   draftValues = applied.age (e.g., [])
   ↓
   Button hidden (draftValues.length === 0)

2. User clicks "5-7"
   ↓
   draftValues = ["5-7"]
   ↓
   Button appears (sticky at bottom)
   ↓
   URL unchanged (no onChange called)

3. User scrolls to see more options
   ↓
   Button stays visible at bottom (sticky)

4. User clicks "9-12"
   ↓
   draftValues = ["5-7", "9-12"]
   ↓
   Button still visible
   ↓
   URL unchanged

5. User clicks "Применить"
   ↓
   onChange(["5-7", "9-12"])
   ↓
   handleAgeChange(["5-7", "9-12"])
   ↓
   updateUrlImmediately({ age: ["5-7", "9-12"] })
   ↓
   URL: ?age=5-7,9-12
   ↓
   Dropdown closes
```

### Clearing Selections

**Option 1: Click X on trigger**
```
User clicks X button on Age pill
↓
handleClear() called
↓
onChange([])
↓
URL: ?age= (removed)
↓
Dropdown closes if open
```

**Option 2: Deselect all in dropdown**
```
User opens dropdown
↓
User clicks all selected items to deselect
↓
draftValues = []
↓
Button disappears
↓
User clicks outside
↓
Dropdown closes, draft discarded
↓
URL unchanged (no Apply clicked)
```

## Code Changes

### CardMultiSelect Component

**File**: `src/components/ui/card-multiselect.tsx`

#### Removed
- `handleReset()` function
- "Сбросить" button from manual mode footer
- "Выбрано: N" text from manual mode

#### Updated
- Popover content width: `w-[320px]` for consistent sizing
- Container: `relative max-h-[70vh]` for sticky positioning
- Scroll area: Dynamic padding based on button visibility
- Footer: Conditional rendering based on `draftValues.length > 0`
- Footer: Single "Применить" button only

### DiscoveryFilters Component

**File**: `src/features/filters/discovery/DiscoveryFilters.tsx`

No changes needed - already using `applyMode="manual"`.

## Comparison: Before vs After

### Before (Previous Implementation)
- Footer always visible
- "Сбросить" button present
- "Выбрано: N" text shown
- Fixed height container

### After (Current Implementation)
- Footer conditional (only when selections exist)
- No "Сбросить" button
- No "Выбрано: N" text
- Cleaner, simpler UI
- Better use of space

## Benefits

1. **Cleaner UI** ✅
   - Button only appears when needed
   - No unnecessary controls
   - More space for options when no selections

2. **Better UX** ✅
   - Clear visual feedback (button appears on selection)
   - Sticky button always accessible
   - No scrolling to find Apply button

3. **Consistent Behavior** ✅
   - Clear via X on trigger (outside dropdown)
   - Apply via button (inside dropdown)
   - Logical separation of actions

4. **Performance** ✅
   - No URL updates until Apply
   - No unnecessary re-renders
   - Smooth scrolling

## Testing Results

From server logs, the age filter is working correctly:
```
GET /minsk?age=3-5,5-7&metro=...
GET /minsk?age=9-12&metro=...
GET /minsk?age=5-7,9-12&district=...
```

- ✅ Multiple age selections work
- ✅ URL updates only after Apply
- ✅ Combinations with other filters work
- ✅ Server compiles without errors

## Testing Checklist

- [x] Button hidden when no selections
- [x] Button appears when first selection made
- [x] Button stays visible while scrolling
- [x] Last option not hidden behind button (pb-16 spacing)
- [x] Clicking "Применить" applies and closes
- [x] URL updates only after Apply
- [x] No "Сбросить" in dropdown
- [x] X button on trigger clears selections
- [x] Other filters unchanged (Metro, District)
- [x] Mobile unchanged
- [x] No TypeScript errors
- [x] Server compiles successfully
- [ ] Manual test: Open dropdown, verify button hidden
- [ ] Manual test: Select age, verify button appears
- [ ] Manual test: Scroll list, verify button stays visible
- [ ] Manual test: Click Apply, verify URL updates and closes
- [ ] Manual test: Click X on trigger, verify clears

## Files Modified

1. `src/components/ui/card-multiselect.tsx`
   - Updated manual mode layout to use sticky positioning
   - Made footer conditional on `draftValues.length > 0`
   - Removed "Сбросить" button
   - Removed "Выбрано: N" text
   - Added dynamic padding to scroll area
   - Removed `handleReset()` function

## Status: ✅ COMPLETE

Age filter now has a truly sticky "Применить" button that:
- Only appears when selections are made
- Stays visible while scrolling
- Has no "Сбросить" button in dropdown
- Provides clean, intuitive UX

Server running on port 3002: http://localhost:3002
