# Plan Audience Chip-Based Layout Refactor ✅

## Overview
Refactored the "Для кого" (audience) block in Plan screen from text-based display to interactive chip-based layout for better readability and UX.

## What Changed

### 1. Removed Old Layout ✅
**Before**:
```
┌─────────────────────────────────────┐
│ [👥] Для кого                       │
│      Для Таи и Степана    [Изменить]│
└─────────────────────────────────────┘
```

**Components Removed**:
- Icon container with Users icon
- Text label with genitive case names
- "Изменить" button
- Border container
- Complex layout structure

### 2. Added Chip Row Layout ✅
**After**:
```
Для кого
[ Тая ] [ Степан ] [ + ]
```

**Structure**:
- Small muted label: "Для кого"
- Chip row below with individual persona chips
- Circular "+" button for adding/editing

### 3. Chip Behavior ✅

**Individual Chips**:
- Each selected persona = one chip
- Label = name only (nominative case, not genitive)
- No checkboxes inside chips
- No remove icons
- Click opens PlanAudienceSheet

**Visual Style**:
```css
border: border-neutral-200
background: bg-neutral-50
padding: px-3.5 py-2
font: text-sm font-medium
color: text-neutral-700
hover: bg-neutral-100 border-neutral-300
```

### 4. "+" Chip ✅

**Design**:
- Circular shape: `h-[34px] w-[34px]`
- Same height as persona chips
- Plus icon (4x4)
- No text label
- White background (vs neutral-50 for persona chips)

**Behavior**:
- Click opens PlanAudienceSheet
- Same as clicking any persona chip

### 5. "Для всех" Mode ✅

**When**: `isAllMode === true` (empty selectedPersonaIds array)

**Display**:
```
Для кого
[ Для всех ]
```

**Rules**:
- Shows only single "Для всех" chip
- Does NOT show individual children chips
- Does NOT show "+" button
- Chip looks active (same style as persona chips)
- Click opens sheet to change selection

### 6. Visual Style Details ✅

**Spacing**:
- Gap between chips: `gap-2` (8px)
- Wraps to next line if needed: `flex-wrap`
- Label spacing: `space-y-2` (8px between label and chips)

**Colors**:
- Label: `text-neutral-500` (muted)
- Chips: `bg-neutral-50` with `border-neutral-200`
- Hover: `bg-neutral-100` with `border-neutral-300`
- "+" button: `bg-white` (slightly different from chips)

**Typography**:
- Label: `text-xs font-medium`
- Chips: `text-sm font-medium`

### 7. Layout Improvements ✅

**Compact**:
- No large containers
- No icon boxes
- No separate button areas
- Minimal vertical space

**Alignment**:
- Consistent with overall mobile spacing
- Works well in both desktop and mobile layouts
- Removed `compact` prop logic (chip layout works universally)

### 8. Interaction Flow ✅

**All clicks lead to sheet**:
1. Click any persona chip → opens PlanAudienceSheet
2. Click "+" button → opens PlanAudienceSheet
3. Click "Для всех" chip → opens PlanAudienceSheet

**No direct selection**:
- Chips are display + trigger only
- No inline editing
- All changes happen in sheet

### 9. State Synchronization ✅

**Uses existing state**:
- `selectedPersonaIds` from parent
- `personas` list from parent
- `isAllMode` computed from parent
- `onClick` handler from parent

**Instant reflection**:
- Changes in sheet immediately update chips
- No delay or loading states
- Smooth transitions

### 10. UX Goals Achieved ✅

**Fast scan**:
- Names visible at a glance
- No need to parse genitive case text
- Clear visual separation

**Clear selection**:
- Each person = one chip
- Easy to count selected personas
- "Для всех" mode obvious

**Easy entry to edit**:
- Click anywhere to edit
- Large touch targets
- Obvious "+" for adding

**No visual noise**:
- Minimal borders
- Soft colors
- Clean spacing
- No unnecessary icons

## Technical Implementation

### Component Structure
```tsx
<div className="space-y-2">
  <p className="text-xs font-medium text-neutral-500">Для кого</p>
  <div className="flex flex-wrap items-center gap-2">
    {isAllMode ? (
      <button>Для всех</button>
    ) : (
      <>
        {selectedPersonas.map(persona => (
          <button key={persona.id}>{persona.displayName}</button>
        ))}
        <button aria-label="Добавить или изменить аудиторию">
          <Plus />
        </button>
      </>
    )}
  </div>
</div>
```

### Removed Code
- `toGenitiveName()` helper function (no longer needed)
- Complex label generation logic
- Conditional rendering for compact mode
- Users icon import
- Border container styling
- "Изменить" button

### Simplified Logic
- No genitive case conversion
- No complex label concatenation
- No conditional layouts
- Single chip style for all modes

## Files Modified

1. `src/features/my-plan/components/PlanAudienceCompact.tsx`
   - Complete refactor from text-based to chip-based layout
   - Removed genitive case logic
   - Removed compact mode conditional rendering
   - Added chip row with individual persona chips
   - Added circular "+" button
   - Simplified component structure

## Visual Comparison

### Before (Text-Based)
```
┌──────────────────────────────────────────┐
│ ┌──┐ Для кого                            │
│ │👥│ Для Таи и Степана      ┌──────────┐ │
│ └──┘                        │ Изменить │ │
│                             └──────────┘ │
└──────────────────────────────────────────┘
```

### After (Chip-Based)
```
Для кого
┌──────┐ ┌─────────┐ ┌───┐
│ Тая  │ │ Степан  │ │ + │
└──────┘ └─────────┘ └───┘
```

### "Для всех" Mode
```
Для кого
┌────────────┐
│ Для всех   │
└────────────┘
```

## Benefits

### Readability
- Names in nominative case (natural reading)
- Visual separation between personas
- Scannable at a glance

### Interaction
- Larger touch targets (entire chip)
- Clear affordance (chips look clickable)
- Obvious "+" for adding more

### Space Efficiency
- More compact than old layout
- Wraps naturally on small screens
- No wasted vertical space

### Consistency
- Matches modern UI patterns
- Similar to tag/chip patterns in other apps
- Familiar interaction model

### Flexibility
- Easy to add more personas
- Scales well with 1-5+ personas
- Handles "Для всех" mode cleanly

## Edge Cases Handled

### No Selection (isAllMode)
- Shows "Для всех" chip
- No "+" button (would be redundant)
- Click opens sheet

### Single Persona
- Shows one chip + "+" button
- Clear and simple

### Multiple Personas
- Shows all chips in row
- Wraps to next line if needed
- "+" button always visible

### Long Names
- Chips expand to fit content
- Natural wrapping behavior
- No truncation needed

## Acceptance Criteria

- [x] Removed text-based layout with "Изменить" button
- [x] Added chip row with label "Для кого"
- [x] Each selected persona shows as individual chip
- [x] Chip shows name only (no checkboxes, no remove icons)
- [x] All chips open PlanAudienceSheet on click
- [x] Added circular "+" button (same height as chips)
- [x] "+" button opens PlanAudienceSheet
- [x] "Для всех" mode shows single chip (no individual chips)
- [x] Chips have soft background and light border
- [x] Spacing between chips is 8px
- [x] Chips wrap to next line if needed
- [x] Layout is compact (no large containers)
- [x] Uses existing shared audience state
- [x] Changes reflect instantly
- [x] Fast scan, clear selection, easy entry
- [x] No visual noise

---

**Status**: Refactor complete, ready for testing
**Date**: 2026-04-04
**Task**: Plan Audience Chip-Based Layout Refactor
