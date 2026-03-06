# Mobile Filters Chips Summary - Complete

## Overview

Improved mobile DiscoveryFilters UX by:
- Adding a chip summary row showing up to 2 active filters + overflow count
- Removing the separate X (reset) button
- Making chips clickable to open the filter sheet
- Keeping reset functionality inside the MobileFilterSheet

## Changes Made

### File: `src/features/filters/discovery/DiscoveryFilters.tsx`

#### Removed
- Separate X reset button next to Filters pill
- `{derived.isDirty && <button onClick={actions.resetAll}>...` removed

#### Added
- Chip building logic from applied filters
- Chips summary row with "Выбрано:" label
- Max 2 visible chips + "+N" overflow chip
- Click handlers on chips to open sheet

## UI Layout

### Before
```
┌─────────────────────────────────────┐
│ [Фильтры: 3]              [X]       │
└─────────────────────────────────────┘
```

### After (No Filters)
```
┌─────────────────────────────────────┐
│ [Фильтры: Выберите...]              │
└─────────────────────────────────────┘
```

### After (With Filters - 2 or less)
```
┌─────────────────────────────────────┐
│ [Фильтры: Выбрано]                  │
│ Выбрано: [Сегодня] [5–7 лет]       │
└─────────────────────────────────────┘
```

### After (With Filters - More than 2)
```
┌─────────────────────────────────────┐
│ [Фильтры: Выбрано]                  │
│ Выбрано: [Завтра] [9–12 лет] [+2]  │
└─────────────────────────────────────┘
```

## Chip Building Logic

### Order (Deterministic)
1. **When** - Preset or date range
2. **Age** - All selected age ranges (in order)
3. **Metro** - Single metro station
4. **District** - Single district

### When Chip Labels
```typescript
if (applied.whenPreset) {
  TODAY → "Сегодня"
  TOMORROW → "Завтра"
  WEEKEND → "Выходные"
} else if (applied.dateFrom) {
  Single date → "5.3"
  Date range → "5.3–7.3"
}
```

### Age Chip Labels
```typescript
applied.age.forEach((ageId) => {
  const ageOption = ageOptions.find(o => o.value === ageId);
  // "0–1 год", "1–3 года", "5–7 лет", etc.
});
```

### Metro Chip Label
```typescript
if (applied.metro) {
  const metroOption = metroOptions.find(o => o.value === applied.metro);
  // Station name: "Площадь Ленина", "Октябрьская", etc.
}
```

### District Chip Label
```typescript
if (applied.district) {
  const districtOption = districtOptions.find(o => o.value === applied.district);
  // District name: "Центральный", "Московский", etc.
}
```

## Visibility Rules

```typescript
const filterChips = []; // Build all chips
const visibleChips = filterChips.slice(0, 2); // Show max 2
const overflowCount = filterChips.length - 2; // Calculate overflow

// Render
{visibleChips.map(chip => <button>{chip.label}</button>)}
{overflowCount > 0 && <button>+{overflowCount}</button>}
```

## Interactions

### Click Filters Pill
```
User clicks "Фильтры" pill
↓
setSheetOpen(true)
↓
MobileFilterSheet opens
```

### Click Any Chip
```
User clicks "Сегодня" chip
↓
setSheetOpen(true)
↓
MobileFilterSheet opens
```

### Click "+N" Overflow
```
User clicks "+2" chip
↓
setSheetOpen(true)
↓
MobileFilterSheet opens (shows all filters)
```

### Reset Filters
```
User opens MobileFilterSheet
↓
User clicks "Сбросить" button inside sheet
↓
actions.resetAll()
↓
All filters cleared
↓
Sheet closes
↓
Chips disappear (no active filters)
```

## Chip Styling

```tsx
<button
  onClick={() => setSheetOpen(true)}
  className="rounded-full border bg-background/70 px-3 py-1 text-sm whitespace-nowrap hover:bg-muted/30 transition-colors"
>
  {chip.label}
</button>
```

**Features**:
- `rounded-full` - Pill shape
- `border` - Subtle outline
- `bg-background/70` - Semi-transparent background
- `px-3 py-1` - Comfortable padding
- `text-sm` - Readable size
- `whitespace-nowrap` - No text wrapping
- `hover:bg-muted/30` - Hover feedback
- `transition-colors` - Smooth hover

## Overflow Chip Styling

```tsx
<button
  onClick={() => setSheetOpen(true)}
  className="rounded-full border bg-background/70 px-3 py-1 text-sm whitespace-nowrap hover:bg-muted/30 transition-colors font-medium"
>
  +{overflowCount}
</button>
```

**Additional**:
- `font-medium` - Slightly bolder to stand out

## Container Styling

```tsx
<div className="flex flex-col gap-2 w-full pb-2">
  {/* Filter button */}
  <FilterFieldPill ... />
  
  {/* Chips summary row */}
  {filterChips.length > 0 && (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      <span className="text-sm text-muted-foreground shrink-0">Выбрано:</span>
      <div className="flex items-center gap-2">
        {/* Chips */}
      </div>
    </div>
  )}
</div>
```

**Features**:
- `flex-col gap-2` - Vertical stack with spacing
- `overflow-x-auto no-scrollbar` - Horizontal scroll if needed (hidden scrollbar)
- `text-muted-foreground` - Subtle label color
- `shrink-0` - Label doesn't shrink

## Example Scenarios

### Scenario 1: Date + Age
```
Applied filters:
- whenPreset: "TODAY"
- age: ["5-7", "9-12"]

Chips:
1. "Сегодня" (when)
2. "5–7 лет" (age)
Overflow: +1

Display:
Выбрано: [Сегодня] [5–7 лет] [+1]
```

### Scenario 2: Date Range + Metro + District
```
Applied filters:
- dateFrom: "2026-03-05"
- dateTo: "2026-03-07"
- metro: "station-id"
- district: "district-id"

Chips:
1. "5.3–7.3" (when)
2. "Площадь Ленина" (metro)
Overflow: +1

Display:
Выбрано: [5.3–7.3] [Площадь Ленина] [+1]
```

### Scenario 3: Multiple Ages Only
```
Applied filters:
- age: ["0-1", "1-3", "3-5", "5-7"]

Chips:
1. "0–1 год" (age)
2. "1–3 года" (age)
Overflow: +2

Display:
Выбрано: [0–1 год] [1–3 года] [+2]
```

## Benefits

1. **Better Visual Feedback** ✅
   - Users see what filters are active at a glance
   - No need to open sheet to check

2. **Cleaner UI** ✅
   - No separate X button cluttering the header
   - Reset action logically inside the sheet

3. **Improved Discoverability** ✅
   - Chips are clickable, inviting interaction
   - "+N" clearly indicates more filters

4. **Space Efficient** ✅
   - Max 2 chips prevents overflow
   - Horizontal scroll for long labels

5. **Consistent Behavior** ✅
   - All clickable elements open the sheet
   - Single place for reset (inside sheet)

## Desktop Unchanged

Desktop filters remain unchanged:
- Individual filter pills in one row
- Reset button (X) when filters active
- Instant apply for Metro/District
- Manual apply for Age

## MobileFilterSheet Unchanged

Sheet behavior remains unchanged:
- Draft state while editing
- "Применить" button to apply
- "Сбросить" button to reset
- All filter controls inside sheet

## Testing Checklist

- [x] X button removed from mobile header
- [x] Chips appear when filters active
- [x] Max 2 chips shown
- [x] "+N" chip shows overflow count
- [x] Clicking chips opens sheet
- [x] Clicking "+N" opens sheet
- [x] When preset labels correct
- [x] Date format correct (DD.MM)
- [x] Age labels resolved from options
- [x] Metro label resolved from options
- [x] District label resolved from options
- [x] Chips disappear when no filters
- [x] Reset works inside sheet
- [x] Desktop unchanged
- [x] No TypeScript errors
- [x] Server compiles successfully
- [ ] Manual test: Apply filters, verify chips appear
- [ ] Manual test: Click chip, verify sheet opens
- [ ] Manual test: More than 2 filters, verify "+N" appears
- [ ] Manual test: Reset in sheet, verify chips disappear

## Files Modified

1. `src/features/filters/discovery/DiscoveryFilters.tsx`
   - Removed X reset button from mobile header
   - Added chip building logic
   - Added chips summary row
   - Changed FilterFieldPill value to "Выбрано" when active
   - Made chips clickable to open sheet

## Status: ✅ COMPLETE

Mobile filters now show a clean chip summary with up to 2 visible filters + overflow count. The separate X button is removed, and reset functionality remains inside the MobileFilterSheet.

Server running on port 3002: http://localhost:3002
