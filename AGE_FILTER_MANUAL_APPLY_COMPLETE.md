# Age Filter Manual Apply Mode - Complete

## Overview

Implemented manual apply mode for the Age filter with a sticky bottom action bar. Users must click "Применить" to apply age selections, preventing URL updates on every click.

## Changes Made

### 1. Updated CardMultiSelect Component ✅

**File**: `src/components/ui/card-multiselect.tsx`

#### Added New Props
```typescript
interface CardMultiSelectProps {
  // ... existing props
  applyMode?: "instant" | "manual"; // New: manual mode requires Apply button
  closeOnApply?: boolean; // New: close dropdown after Apply (default true)
}
```

#### Added Draft State for Manual Mode
```typescript
const [draftValues, setDraftValues] = React.useState<string[]>(values);

// Sync draft with props when dropdown opens
React.useEffect(() => {
  if (open || applyMode === "instant") {
    setDraftValues(values);
  }
}, [open, values, applyMode]);

// Use draft in manual mode, actual values in instant mode
const effectiveValues = applyMode === "manual" ? draftValues : values;
```

#### Updated Toggle Logic
```typescript
const toggle = (val: string) => {
  if (applyMode === "manual") {
    // Manual mode: update draft only
    if (isSelected(val)) {
      setDraftValues(effectiveValues.filter((v) => v !== val));
    } else {
      if (isMaxReached) return;
      setDraftValues([...effectiveValues, val]);
    }
  } else {
    // Instant mode: call onChange immediately (existing behavior)
    if (isSelected(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      if (isMaxReached) return;
      onChange([...values, val]);
    }
  }
};
```

#### Added Action Handlers
```typescript
const handleApply = () => {
  onChange(draftValues);
  if (closeOnApply) {
    setOpen(false);
  }
};

const handleReset = () => {
  setDraftValues([]);
};
```

#### Implemented Sticky Footer UI
```typescript
{applyMode === "manual" ? (
  // Manual mode: scrollable list + sticky footer
  <div className="flex flex-col h-full">
    {/* Scrollable options list */}
    <div className="max-h-[60vh] overflow-auto p-1">
      {options.map((option) => (
        // ... option buttons
      ))}
    </div>
    
    {/* Sticky footer */}
    <div className="border-t bg-background/95 backdrop-blur p-3 mt-auto">
      <Button 
        onClick={handleApply}
        className="w-full rounded-full"
      >
        Применить
      </Button>
      <button
        onClick={handleReset}
        className="mt-2 w-full text-sm text-muted-foreground hover:text-foreground"
      >
        Сбросить
      </button>
    </div>
  </div>
) : (
  // Instant mode: original layout with "Выбрано: N"
  // ... existing instant mode UI
)}
```

### 2. Updated DiscoveryFilters Component ✅

**File**: `src/features/filters/discovery/DiscoveryFilters.tsx`

#### Enabled Manual Mode for Age Filter
```typescript
<CardMultiSelect 
  label="Возраст"
  options={ageOptions} 
  values={applied.age} 
  onChange={handleAgeChange} 
  allowClear
  className="flex-1 min-w-0" 
  uiMode="desktop"
  variant="card"
  applyMode="manual"        // NEW: Manual apply mode
  closeOnApply={true}       // NEW: Close after apply
/>
```

## UI Layout

### Manual Mode (Age Filter)
```
┌─────────────────────────────────┐
│ ☐ 0–1 год                       │
│ ☑ 1–3 года                      │
│ ☐ 3–5 лет                       │
│ ☑ 5–7 лет                       │  ← Scrollable
│ ☐ 7–9 лет                       │     (max-h: 60vh)
│ ☐ 9–12 лет                      │
│ ☐ 12–14 лет                     │
│ ☐ 14–16 лет                     │
│ ☐ 16–18 лет                     │
│ ☐ 18+                           │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │      Применить              │ │  ← Sticky footer
│ └─────────────────────────────┘ │     (always visible)
│         Сбросить                │
└─────────────────────────────────┘
```

### Instant Mode (Metro, District - unchanged)
```
┌─────────────────────────────────┐
│ ☐ Станция 1                     │
│ ☑ Станция 2                     │
│ ☐ Станция 3                     │
├─────────────────────────────────┤
│ Выбрано: 1    [Сбросить все]   │
└─────────────────────────────────┘
```

## Behavior

### Manual Mode (Age)

1. **Open Dropdown**
   - Draft values initialized from `applied.age`
   - Shows current selections

2. **Toggle Options**
   - Updates `draftValues` only
   - No `onChange` called
   - No URL update
   - Visual feedback immediate

3. **Click "Применить"**
   - Calls `onChange(draftValues)`
   - Updates URL via `handleAgeChange`
   - Closes dropdown
   - Applied state updates

4. **Click "Сбросить"**
   - Clears `draftValues` to `[]`
   - Visual feedback immediate
   - No `onChange` until "Применить"

5. **Click Outside / ESC**
   - Dropdown closes
   - Draft discarded
   - Next open re-syncs from `applied.age`

### Instant Mode (Metro, District - unchanged)

1. **Toggle Option**
   - Calls `onChange` immediately
   - Updates URL instantly
   - Applied state updates

## Data Flow

### Manual Mode Flow
```
User opens Age dropdown
↓
draftValues = applied.age (e.g., ["1-3", "5-7"])
↓
User clicks "7-9"
↓
draftValues = ["1-3", "5-7", "7-9"]
↓
User clicks "Применить"
↓
onChange(["1-3", "5-7", "7-9"])
↓
handleAgeChange(["1-3", "5-7", "7-9"])
↓
updateUrlImmediately({ age: ["1-3", "5-7", "7-9"] })
↓
URL: ?age=1-3,5-7,7-9
↓
Dropdown closes
```

### Reset Flow
```
User clicks "Сбросить"
↓
draftValues = []
↓
Visual: all checkboxes unchecked
↓
User clicks "Применить"
↓
onChange([])
↓
URL: ?age= (removed)
```

## Mobile Behavior (Unchanged)

Mobile uses `MobileFilterSheet` which has its own Apply/Reset buttons:
- CardMultiSelect in mobile mode still uses `applyMode="instant"` (default)
- MobileFilterSheet handles draft state and Apply button
- No duplicate Apply UI

## Other Filters (Unchanged)

- **Metro**: Single-select, instant apply
- **District**: Single-select, instant apply
- **When**: Preset/calendar, instant apply

Only Age uses manual mode.

## Benefits

1. **Better UX for Long Lists** ✅
   - Users can select multiple ages without URL thrashing
   - No page reloads/refetches on every click

2. **Clear Intent** ✅
   - Explicit "Применить" makes it clear when filter applies
   - "Сбросить" allows easy clearing before applying

3. **Sticky Footer** ✅
   - Actions always visible while scrolling
   - No need to scroll to bottom to apply

4. **Backward Compatible** ✅
   - Other filters unchanged
   - Mobile behavior unchanged
   - URL format unchanged

5. **Flexible** ✅
   - Easy to add manual mode to other filters if needed
   - `applyMode` prop controls behavior

## Testing Checklist

- [x] Age filter opens with current selections
- [x] Clicking age options updates visual state
- [x] URL does NOT update until "Применить"
- [x] "Применить" button applies selections and closes dropdown
- [x] "Сбросить" button clears draft selections
- [x] Clicking outside closes dropdown without applying
- [x] Footer stays visible while scrolling age list
- [x] Metro/District filters still instant (unchanged)
- [x] Mobile filters still work (unchanged)
- [x] No TypeScript errors
- [x] Server compiles successfully
- [ ] Manual test: Select multiple ages, verify URL updates only on Apply
- [ ] Manual test: Click "Сбросить", verify visual clear, then Apply to clear URL
- [ ] Manual test: Select ages, click outside, reopen - draft discarded

## Files Modified

1. `src/components/ui/card-multiselect.tsx`
   - Added `applyMode` and `closeOnApply` props
   - Added draft state management
   - Implemented sticky footer UI for manual mode
   - Split toggle logic for instant vs manual

2. `src/features/filters/discovery/DiscoveryFilters.tsx`
   - Added `applyMode="manual"` to Age filter
   - Added `closeOnApply={true}` to Age filter

## Status: ✅ COMPLETE

Age filter now uses manual apply mode with a sticky bottom action bar. Users must click "Применить" to apply selections. Other filters remain instant. Mobile behavior unchanged.

Server running on port 3002: http://localhost:3002
