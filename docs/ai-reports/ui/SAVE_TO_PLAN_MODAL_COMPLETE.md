# Save to Plan Modal - Complete ✅

## Summary
Successfully implemented a "caring" save modal that reuses existing UI primitives from the project. The modal provides three different user experiences based on the activity's scheduling information.

## Implementation

### 1. SaveToPlanModal Component ✅
**File**: `src/components/activity/SaveToPlanModal.tsx`

**Features**:
- Reuses existing UI components (Sheet, Button, Separator, WhenSelect)
- Matches styling patterns from filter sheets
- Three distinct scenarios with appropriate UX

**Scenarios**:

#### Case A: Confirm (Single Date + Time)
- Shows: "Добавить в план?"
- Displays: Activity title, date, and time
- Actions: "Добавить" (primary) + "В идеи" (secondary)
- Use case: Event with specific date and time

#### Case B: Timeslots (Multiple Times)
- Shows: "Выберите время"
- Displays: Activity title, date, and radio group of time slots
- Custom radio buttons (no RadioGroup component exists in project)
- Actions: "Добавить" (primary) + "В идеи" (secondary)
- Use case: Event with multiple session times

#### Case C: Quickdate (No Date/Time)
- Shows: "Когда планируем?"
- Quick actions: "Сегодня", "Завтра", "Выбрать дату"
- Reuses WhenSelect component with variant="embedded"
- Separate "В идеи" button below separator
- Use case: Place or activity without specific schedule

### 2. ActivityCard Integration ✅
**File**: `src/components/activity/ActivityCard.tsx`

**New Props**:
```typescript
export type ActivitySaveMeta = {
  title: string;
  dateISO?: string | null;
  dateLabel?: string | null;
  timeSlots?: { id: string; label: string }[] | null;
  timeLabel?: string | null;
};

// Added to AdapterProps:
saveMeta?: ActivitySaveMeta;
onSaveResult?: (result: SaveToPlanResult) => void;
```

**Behavior**:
- Heart button replaces SaveHeart component when saveMeta is provided
- Click prevention: `e.preventDefault()` + `e.stopPropagation()`
- Scenario detection logic:
  - Single date + single time/slot → confirm
  - Single date + multiple slots → timeslots
  - No date or no time → quickdate
- Opens modal with appropriate scenario
- Calls onSaveResult callback with user's choice

### 3. UI-Lab Demo ✅
**File**: `src/app/(ui)/ui-lab/_sections/ActivitySection.tsx`

**Three Demo Cards**:

1. **Confirm Demo**: "Жаночы дзень"
   - Date: 2026-03-08
   - Time: 18:00
   - Tests single date + time confirmation

2. **Timeslots Demo**: "Мастер-класс по робототехнике"
   - Date: 2026-03-09
   - Slots: 10:00, 13:00, 18:00
   - Tests multiple time slot selection

3. **Quickdate Demo**: "Семейное кафе «Андерсон»"
   - No date/time provided
   - Tests quick date picker flow

**Toast Feedback**:
- Uses `sonner` toast library (already in project)
- Plan: "Добавлено в план на [date]"
- Ideas: "Сохранено в идеи"
- Console logs for debugging

## UI Components Reused

### From Project UI Library:
- ✅ `Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle` - Modal container
- ✅ `Button` - All action buttons (primary, secondary, sizes)
- ✅ `Separator` - Visual divider in quickdate flow
- ✅ `WhenSelect` - Date picker with variant="embedded"
- ✅ `toast` from `sonner` - Success feedback

### Styling Patterns Matched:
- Bottom sheet with rounded top (`rounded-t-3xl`)
- Sticky footer with backdrop blur
- Safe area insets for mobile (`pb-[calc(16px+env(safe-area-inset-bottom))]`)
- Border styling (`border-border/60`, `border-border/40`)
- Button styling (rounded-full for primary actions)
- Consistent padding and gaps

## Custom Implementation

### Radio Group (Manual)
Since no RadioGroup component exists in the project, implemented custom radio buttons:
- Visual radio circles with inner dot when selected
- Full-width clickable buttons
- Border highlight on selection
- Matches project's design tokens

## Result Types

```typescript
export type SaveToPlanResult =
  | { action: "plan"; dateISO: string; timeSlotId?: string | null }
  | { action: "ideas" }
  | { action: "cancel" };
```

## User Flow

### Confirm Flow:
1. User clicks heart on activity card
2. Modal shows: "Добавить в план? [Title] [Date] • [Time]"
3. User chooses: "Добавить" or "В идеи"
4. Toast confirms action
5. Modal closes

### Timeslots Flow:
1. User clicks heart on activity card
2. Modal shows: "Выберите время [Title] [Date]"
3. User selects time slot from radio group
4. User chooses: "Добавить" or "В идеи"
5. Toast confirms action with selected time
6. Modal closes

### Quickdate Flow:
1. User clicks heart on activity card
2. Modal shows: "Когда планируем? [Title]"
3. User chooses:
   - "Сегодня" → Immediate add to plan
   - "Завтра" → Immediate add to plan
   - "Выбрать дату" → Opens embedded calendar
   - "В идеи" → Saves to ideas
4. Toast confirms action
5. Modal closes

## Validation ✅

✅ TypeScript: No errors
✅ Build: Passes successfully (`pnpm build`)
✅ No custom UI components created
✅ All UI primitives from existing project
✅ Heart click doesn't navigate to activity page
✅ Modal styling matches filter sheets
✅ Toast feedback works
✅ Three scenarios demonstrated in UI-lab
✅ Responsive (mobile-first with Sheet)

## Files Created
1. `src/components/activity/SaveToPlanModal.tsx` - Modal component

## Files Modified
1. `src/components/activity/ActivityCard.tsx` - Added saveMeta props and modal integration
2. `src/app/(ui)/ui-lab/_sections/ActivitySection.tsx` - Added 3 demo cards with toast feedback

## Next Steps

### For Production:
1. **API Integration**: Wire onSaveResult to actual save endpoints
   - POST to `/api/save/plan` for plan additions
   - POST to `/api/save/idea` for ideas
   
2. **State Management**: Add saved state to heart button
   - Show filled heart when saved
   - Update on successful save
   
3. **Error Handling**: Add error states to modal
   - Network errors
   - Validation errors
   
4. **Loading States**: Add loading indicators
   - During save operation
   - Disable buttons while saving

5. **Persistence**: Store user's plan/ideas
   - Update database
   - Sync with user profile
   - Show in /me/plan and /me/ideas

## Design Decisions

### Why Sheet instead of Dialog?
- Mobile-first approach (matches project patterns)
- Better UX on mobile devices
- Consistent with filter sheets
- Can be upgraded to responsive Dialog later if needed

### Why Manual Radio Buttons?
- No RadioGroup component in project
- Avoided adding new dependencies
- Simple implementation with existing primitives
- Matches project's visual style

### Why Embedded WhenSelect?
- Reuses existing date picker logic
- Consistent calendar UX across app
- No duplicate calendar implementation
- Variant="embedded" perfect for modal context

## Testing in UI-Lab

Visit `/ui-lab` and scroll to "Activity Components" section to test:
1. Click heart on "Жаночы дзень" → Confirm modal
2. Click heart on "Мастер-класс" → Timeslots modal
3. Click heart on "Семейное кафе" → Quickdate modal

Each interaction shows toast feedback and logs to console.
