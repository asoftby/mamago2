# Plan Audience Free Search Mode Refactor ✅

## Overview
Refactored audience chip logic in Plan screen to support toggle-based selection between personalized mode (specific participants) and non-personalized "Свободный поиск" mode.

## What Changed

### 1. Chip Row Layout ✅
**All chips visible at once**:
```
Для кого
[ Степан ] [ Тая ] [ Я ] [ Свободный поиск ] [ + ]
```

**Key Change**: All persona chips + "Свободный поиск" chip are always visible, not conditional.

### 2. Audience Modes ✅

**Defined two modes**:
```typescript
audienceMode: "specific" | "free"
```

**Mode Logic**:
- `"specific"`: One or more personas selected
- `"free"`: No personas selected (empty array)

**Computed automatically**:
```typescript
const audienceMode = selectedChildIds.length > 0 ? "specific" : "free";
```

### 3. "Свободный поиск" Behavior ✅

**On click**:
1. Set `audienceMode = "free"`
2. Clear `selectedPersonaIds` (empty array)
3. Clear `selectedAgeRanges`
4. Deactivate all persona chips
5. Activate "Свободный поиск" chip
6. Sync with family context

**Visual State**:
- Active: `border-primary bg-primary/10 text-primary`
- Inactive: `border-neutral-200 bg-white text-neutral-500`

**Implementation**:
```typescript
const handleToggleFreeMode = () => {
  onChangeSelectedChildIds([]);
  onChangeSelectedAgeRanges([]);
  if (family?.setSelectedPersonaIds) {
    family.setSelectedPersonaIds([]);
  }
};
```

### 4. Persona Chips Behavior ✅

**On click**:
- Toggle persona in `selectedPersonaIds`
- If selecting: automatically set `audienceMode = "specific"`
- If deselecting: remove from array
- Deactivate "Свободный поиск" when any persona selected
- Sync with family context

**Implementation**:
```typescript
const handleTogglePersona = (personaId: string) => {
  const isSelected = selectedChildIds.includes(personaId);
  
  if (isSelected) {
    // Deselect
    const newIds = selectedChildIds.filter((id) => id !== personaId);
    onChangeSelectedChildIds(newIds);
    
    // Auto-switch to free mode if no personas left
    if (newIds.length === 0) {
      onChangeSelectedAgeRanges([]);
    }
  } else {
    // Select (switches to specific mode)
    const newIds = [...selectedChildIds, personaId];
    onChangeSelectedChildIds(newIds);
  }
  
  // Sync with family context
  if (family?.setSelectedPersonaIds) {
    family.setSelectedPersonaIds(newIds);
  }
};
```

### 5. Empty Selection Fallback ✅

**Automatic behavior**:
- When all persona chips are deselected
- Automatically activate "Свободный поиск"
- Set `audienceMode = "free"`
- Clear age ranges

**Logic**:
```typescript
if (newIds.length === 0) {
  onChangeSelectedAgeRanges([]);
}
```

### 6. "+" Chip Behavior ✅

**On click**:
- Opens `QuickAddChildModal`
- Allows adding new child or adult
- Does not change current selection

**Visual**:
- Circular shape: `h-[34px] w-[34px]`
- White background (distinct from other chips)
- Plus icon

### 7. State Synchronization ✅

**Shared state**:
- `selectedPersonaIds` (from parent)
- `audienceMode` (computed from selectedPersonaIds)
- Syncs with `FamilyPersonaContext`

**Two-way sync**:
```typescript
// Update local state
onChangeSelectedChildIds(newIds);

// Sync with family context
if (family?.setSelectedPersonaIds) {
  family.setSelectedPersonaIds(newIds);
}
```

### 8. Age Controls ✅

**Removed from Plan**:
- No age controls in Plan screen
- Age remains configured only in header
- Age ranges cleared when switching to free mode

**Rationale**:
- Simpler UX in Plan
- Age is persona-specific (configured in header)
- Free mode doesn't need age filters

### 9. UX Improvements ✅

**No modal on chip click**:
- Instant visual toggle
- No intermediate steps
- Direct feedback

**Clean chip states**:
- Active: Primary color with light background
- Inactive: Neutral with white background
- Clear visual distinction

**Clear mode distinction**:
- Personalized: One or more persona chips active
- Free: Only "Свободный поиск" active

### 10. Helper Text ✅

**When `audienceMode = "free"`**:
```
Для кого
[ Степан ] [ Тая ] [ Я ] [ Свободный поиск ] [ + ]
Показываем популярные и универсальные варианты
```

**Styling**:
- `text-xs text-neutral-400`
- Positioned below chip row
- Only visible in free mode

## Visual States

### Specific Mode (Personas Selected)
```
Для кого
[ Степан* ] [ Тая* ] [ Я ] [ Свободный поиск ] [ + ]
```
*Active chips shown with primary color

### Free Mode (No Personas)
```
Для кого
[ Степан ] [ Тая ] [ Я ] [ Свободный поиск* ] [ + ]
Показываем популярные и универсальные варианты
```
*"Свободный поиск" active

### Mixed Selection
```
Для кого
[ Степан* ] [ Тая ] [ Я ] [ Свободный поиск ] [ + ]
```
*Only Степан selected

## Component API Changes

### PlanAudienceCompact Props

**Before**:
```typescript
interface PlanAudienceCompactProps {
  selectedPersonaIds: string[];
  personas: Array<...>;
  isAllMode: boolean;
  onClick: () => void;
  onAddClick: () => void;
}
```

**After**:
```typescript
interface PlanAudienceCompactProps {
  selectedPersonaIds: string[];
  personas: Array<...>;
  audienceMode: "specific" | "free";
  onTogglePersona: (personaId: string) => void;
  onToggleFreeMode: () => void;
  onAddClick: () => void;
}
```

**Key Changes**:
- Removed `isAllMode` → replaced with `audienceMode`
- Removed `onClick` → replaced with `onTogglePersona` and `onToggleFreeMode`
- Added granular control for each interaction

## Technical Implementation

### Chip Rendering
```tsx
{/* Persona chips */}
{personas.map((persona) => {
  const isSelected = selectedPersonaIds.includes(persona.id);
  const isActive = !isFreeMode && isSelected;
  
  return (
    <button
      onClick={() => onTogglePersona(persona.id)}
      className={cn(
        isActive
          ? "border-primary bg-primary/10 text-primary"
          : "border-neutral-200 bg-white text-neutral-500"
      )}
    >
      {persona.displayName}
    </button>
  );
})}

{/* Free search chip */}
<button
  onClick={onToggleFreeMode}
  className={cn(
    isFreeMode
      ? "border-primary bg-primary/10 text-primary"
      : "border-neutral-200 bg-white text-neutral-500"
  )}
>
  Свободный поиск
</button>
```

### State Management
```typescript
// Computed mode
const audienceMode = selectedChildIds.length > 0 ? "specific" : "free";

// Toggle persona
const handleTogglePersona = (personaId: string) => {
  const isSelected = selectedChildIds.includes(personaId);
  const newIds = isSelected
    ? selectedChildIds.filter((id) => id !== personaId)
    : [...selectedChildIds, personaId];
  
  onChangeSelectedChildIds(newIds);
  
  // Auto-clear age ranges if empty
  if (newIds.length === 0) {
    onChangeSelectedAgeRanges([]);
  }
  
  // Sync with context
  family?.setSelectedPersonaIds(newIds);
};

// Toggle free mode
const handleToggleFreeMode = () => {
  onChangeSelectedChildIds([]);
  onChangeSelectedAgeRanges([]);
  family?.setSelectedPersonaIds([]);
};
```

## Files Modified

1. `src/features/my-plan/components/PlanAudienceCompact.tsx`
   - Changed props interface (removed isAllMode, onClick)
   - Added audienceMode, onTogglePersona, onToggleFreeMode
   - Render all chips always (not conditional)
   - Added active/inactive states with primary color
   - Added helper text for free mode
   - Removed useMemo for selectedPersonas (not needed)

2. `src/features/my-plan/components/PlanMainContent.tsx`
   - Added audienceMode computation
   - Added handleTogglePersona function
   - Added handleToggleFreeMode function
   - Updated PlanAudienceCompact usage (both desktop and mobile)
   - Added family context sync

## Benefits

### User Experience
- **Instant feedback**: No modal delays
- **Clear state**: Visual distinction between modes
- **Flexible**: Easy to switch between personalized and free
- **Discoverable**: All options visible at once

### Technical
- **Simpler logic**: No complex modal flows
- **Better sync**: Direct state updates
- **Cleaner code**: Removed conditional rendering
- **Type-safe**: Explicit mode enum

### Performance
- **No re-renders**: Direct state updates
- **No modal overhead**: Instant toggles
- **Efficient**: Computed mode (no extra state)

## Edge Cases Handled

### No Personas Available
- Shows only "Свободный поиск" and "+" chips
- Free mode active by default

### Single Persona
- Can toggle on/off
- Auto-switches to free mode when deselected

### All Personas Selected
- All chips active
- "Свободный поиск" inactive
- Can still click to switch to free mode

### Rapid Toggling
- State updates immediately
- No race conditions
- Sync with context on each change

## Acceptance Criteria

- [x] Chip row shows all personas + "Свободный поиск" + "+"
- [x] Defined audienceMode: "specific" | "free"
- [x] "Свободный поиск" click clears selections and activates free mode
- [x] Persona chip click toggles selection
- [x] Any persona selection deactivates "Свободный поиск"
- [x] Empty selection automatically activates "Свободный поиск"
- [x] "+" chip opens add participant flow
- [x] Syncs with shared state (selectedPersonaIds, audienceMode)
- [x] Syncs with header via FamilyPersonaContext
- [x] No age controls in Plan (only in header)
- [x] No modal on chip click (instant toggle)
- [x] Clean chip states (active/inactive)
- [x] Clear distinction between personalized vs free
- [x] Helper text shown in free mode

---

**Status**: Refactor complete, ready for testing
**Date**: 2026-04-04
**Task**: Plan Audience Free Search Mode Implementation
