# My Plan Refactor: Slots to Chronological Timeline - COMPLETE

## Summary
Successfully refactored "My Plan" from a 3-slot-based architecture (Morning/Afternoon/Evening) to a chronological event list sorted by actual event time.

## Changes Made

### Phase 1: State Management (useMyPlan.tsx)
- **Removed**: Slot-based state (`slotAlternativeCursor`, `slotPlanItemsByDate`, `slotPendingSuggestionByDate`)
- **Added**: Chronological plan storage (`planItemsByDateMap`)
- **New functions**:
  - `addPlanItem()`: Adds item to plan and auto-sorts by `startsAt`
  - `removePlanItem()`: Removes item from plan
- **Deprecated (kept for backward compatibility)**:
  - `planSlots` now returns empty array
  - `cycleSlotAlternative()`, `cycleSlotAlternativePrev()` are no-ops
  - `openSlotSuggestion()` is no-op
- **Updated return value**: 
  - `planItemsByDate` now uses `planItemsByDateMap` (chronological)
  - `markSlotSaved` → `addPlanItem`
  - `clearSlotSaved` → `removePlanItem`
  - `todayItems` computed from `planItemsByDateMap[today]`

### Phase 2: UI Components (PlanMainContent.tsx)
- **Removed**:
  - `TIME_PERIODS` constant (Morning/Afternoon/Evening)
  - `PERIOD_ORDER` constant
  - `slotForPeriod()` function
  - `handleOpenSuggestionsSheet()` function
  - `PlanSuggestionsSheet` component (slot-based suggestions)
  - `suggestionsSheetSlot` state
  - Slot-based rendering logic
- **Updated**:
  - `handleAddToPlan()`: Now takes only `item` (no slot parameter)
  - `handleRemoveFromPlan()`: Now takes only `itemId` (no slot parameter)
  - `buildFindAndAddHref()`: Removed `timeSlot` parameter
  - `handleFindAndAddClick()`: Removed slot parameter
  - `totalPlannedCount`: Now computed from `dayItems.length`
- **New rendering**:
  - Desktop: Chronological list of plan items for selected date
  - Mobile: Same chronological list
  - Empty state: Single "Add event" button when no items
  - Add more: "Add more" button after items list
- **Removed imports**: `Moon`, `Sunrise`, `Sparkles`, `MAX_PLAN_ITEMS_PER_SLOT`, `PlanSuggestionsSheet`

## Data Model

### Before (Slot-based)
```
slotPlanItemsByDate: {
  "2024-01-15": {
    "morning": [item1, item2],
    "afternoon": [item3],
    "evening": []
  }
}
```

### After (Chronological)
```
planItemsByDateMap: {
  "2024-01-15": [
    { id: "...", startsAt: "10:00", title: "Event A" },
    { id: "...", startsAt: "13:30", title: "Event B" },
    { id: "...", startsAt: "17:00", title: "Event C" },
    { id: "...", startsAt: null, title: "Event without time" }
  ]
}
```

## Edge Cases Handled

1. **Multiple events same time**: Preserved via `createdAt` order
2. **Events without time**: Sorted to end of list (startsAt: null)
3. **Empty day**: Shows single "Add event" button
4. **Sorting**: Automatic via `useMemo` in `addPlanItem()`
5. **Duplicate prevention**: Checks `item.id` before adding

## Backward Compatibility

- `planSlots` still exported but returns empty array
- Slot-based callback functions still accepted but are no-ops
- Props interface unchanged (deprecated props marked as such)
- Existing code passing slot parameters continues to work

## Files Modified

1. `src/features/my-plan/hooks/useMyPlan.tsx` - State management refactor
2. `src/features/my-plan/components/PlanMainContent.tsx` - UI refactor

## Files NOT Modified (No changes needed)

- `src/features/my-plan/types/event.ts` - Type definitions still valid
- `src/features/my-plan/lib/recommendationPool.ts` - Can be deprecated later
- `src/features/my-plan/components/DayScenarioModal.tsx` - Already works with real data
- `src/features/my-plan/components/MyPlanPanelContent.tsx` - Still passes old props (backward compatible)

## Testing Recommendations

1. Add event to plan - should appear in chronological order
2. Add multiple events - verify sorting by `startsAt`
3. Add event without time - should appear at end
4. Remove event - should update list
5. Change date - should show different plan items
6. Empty day - should show "Add event" button
7. Day scenario - should work with chronological items

## Next Steps (Future)

1. Delete `PlanSlots.tsx` component (no longer used)
2. Deprecate `recommendationPool.ts` (slot-based logic)
3. Remove slot-based parameters from prop interfaces
4. Update any remaining references to slot terminology
5. Consider adding time picker for events without time

## Status

✅ **COMPLETE** - My Plan now uses chronological timeline instead of fixed slots
