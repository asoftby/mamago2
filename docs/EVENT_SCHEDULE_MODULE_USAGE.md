# Event Schedule Module - Complete

**Date**: 2026-03-14  
**Status**: ✅ Complete  
**Location**: ui-lab-admin

---

## Overview

Created a reusable Event Schedule UI module for admin interface. The module provides a clean card-based interface for entering event dates with support for multi-day events, all-day events, and recurring events.

---

## Components Created

### 1. Types (`src/components/admin/event-schedule/types.ts`)

```typescript
export type RecurrenceUnit = "day" | "week" | "month" | "year";

export interface EventScheduleItem {
  id: string;
  isMultiDay: boolean;
  date: string | null;
  allDay: boolean;
  startTime: string;
  endTime: string;
  recurringEnabled: boolean;
  recurrenceInterval: number;
  recurrenceUnit: RecurrenceUnit;
  recurrenceUntil: string | null;
  isCollapsed?: boolean;
}
```

### 2. EventScheduleCard (`src/components/admin/event-schedule/EventScheduleCard.tsx`)

**Features**:
- Collapsible card with header
- Delete button (only when multiple cards)
- Multi-day toggle
- Date picker
- All-day event toggle
- Time fields (start/end) - hidden when all-day is enabled
- Recurring event toggle
- Recurrence configuration block:
  - Interval (number)
  - Period (day/week/month/year)
  - Until date
- Collapsed summary view

**Props**:
```typescript
interface EventScheduleCardProps {
  item: EventScheduleItem;
  onChange: (item: EventScheduleItem) => void;
  onRemove: () => void;
  canRemove: boolean;
}
```

### 3. EventScheduleList (`src/components/admin/event-schedule/EventScheduleList.tsx`)

**Features**:
- Manages array of schedule items
- Add new date button
- Handles item updates and removals
- Creates new items with sensible defaults

**Props**:
```typescript
interface EventScheduleListProps {
  items: EventScheduleItem[];
  onChange: (items: EventScheduleItem[]) => void;
}
```

### 4. EventScheduleSection (`src/app/(ui)/ui-lab-admin/_sections/EventScheduleSection.tsx`)

Demo section in ui-lab-admin showing three states:
1. Single event (no recurring)
2. Recurring event
3. Multiple dates

---

## UI Design

### Visual Style

- **Clean admin aesthetic**: Light, spacious, readable
- **Card-based**: White cards with subtle borders
- **Rounded corners**: 12px border radius (rounded-xl)
- **Generous spacing**: 24px padding, 24px gaps
- **Muted labels**: Gray-700 for labels, Gray-900 for values
- **Premium look**: No heavy enterprise UI

### Layout Structure

```
┌─────────────────────────────────────┐
│ Header                              │
│ "Дата"              [Delete] [▼]    │
├─────────────────────────────────────┤
│ Body                                │
│                                     │
│ Несколько дней?          [Switch]  │
│                                     │
│ Дата                                │
│ [Date Picker]                       │
│                                     │
│ All-day event            [Switch]  │
│                                     │
│ Начало        Конец                 │
│ [10:00]       [18:00]               │
│                                     │
│ Recurring event?         [Switch]  │
│                                     │
│ ┌─ Recurrence Block ──────────────┐│
│ │ Повторять каждые    Period      ││
│ │ [2]                 [Неделя]    ││
│ │                                 ││
│ │ До                              ││
│ │ [Date Picker]                   ││
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘

[+ Добавить дату]
```

### Collapsed State

```
┌─────────────────────────────────────┐
│ Дата                    [Delete] [▶]│
├─────────────────────────────────────┤
│ 2024-03-20 10:00 - 18:00            │
│ Повторяется каждые 2 week           │
└─────────────────────────────────────┘
```

---

## Behavior

### Conditional Display

1. **Time fields**: Hidden when `allDay = true`
2. **Recurrence block**: Hidden when `recurringEnabled = false`
3. **Delete button**: Hidden when only one card exists
4. **Card body**: Hidden when `isCollapsed = true`

### Default Values

New schedule item:
```typescript
{
  id: "schedule-{timestamp}-{random}",
  isMultiDay: false,
  date: null,
  allDay: false,
  startTime: "10:00",
  endTime: "18:00",
  recurringEnabled: false,
  recurrenceInterval: 1,
  recurrenceUnit: "week",
  recurrenceUntil: null,
  isCollapsed: false,
}
```

---

## Location

**UI Lab**: `/ui-lab-admin` (scroll to bottom)

**Components**:
- `src/components/admin/event-schedule/types.ts`
- `src/components/admin/event-schedule/EventScheduleCard.tsx`
- `src/components/admin/event-schedule/EventScheduleList.tsx`

**Demo**:
- `src/app/(ui)/ui-lab-admin/_sections/EventScheduleSection.tsx`

---

## Integration Guide

### Step 1: Import Component

```typescript
import { EventScheduleList } from "@/components/admin/event-schedule/EventScheduleList";
import type { EventScheduleItem } from "@/components/admin/event-schedule/types";
```

### Step 2: Add State

```typescript
const [scheduleItems, setScheduleItems] = useState<EventScheduleItem[]>([
  {
    id: "1",
    isMultiDay: false,
    date: null,
    allDay: false,
    startTime: "10:00",
    endTime: "18:00",
    recurringEnabled: false,
    recurrenceInterval: 1,
    recurrenceUnit: "week",
    recurrenceUntil: null,
  },
]);
```

### Step 3: Render Component

```typescript
<EventScheduleList 
  items={scheduleItems} 
  onChange={setScheduleItems} 
/>
```

### Step 4: Convert to Event Wizard Format

```typescript
// EventScheduleItem[] → EventFormData
const dates = scheduleItems
  .filter(item => item.date)
  .map(item => item.date!);

const scheduleJson = scheduleItems
  .filter(item => item.recurringEnabled)
  .map(item => ({
    date: item.date,
    recurrence: {
      interval: item.recurrenceInterval,
      unit: item.recurrenceUnit,
      until: item.recurrenceUntil,
    },
  }));

// Update Event Wizard state
onChange({
  dates,
  scheduleMode: dates.length > 1 ? "multiple" : "single",
  allDay: scheduleItems[0]?.allDay || false,
  startTime: scheduleItems[0]?.startTime || "",
  endTime: scheduleItems[0]?.endTime || "",
  scheduleJson: JSON.stringify(scheduleJson),
});
```

---

## Event Wizard Integration Plan

### Current Event Wizard Step 4

**File**: `src/components/business/wizard/event/steps/Step4DateTime.tsx`

**Current Structure**:
- scheduleMode: "single" | "multiple"
- dates: string[]
- allDay: boolean
- startTime: string
- endTime: string
- repeatEnabled: boolean
- repeatUnit: string

### Migration Steps

1. **Replace UI** with EventScheduleList
2. **Map data** between EventScheduleItem[] and EventFormData
3. **Update validation** to work with new structure
4. **Test** create/edit/submit flow

### Example Integration

```typescript
// Step4DateTime.tsx
import { EventScheduleList } from "@/components/admin/event-schedule/EventScheduleList";
import type { EventScheduleItem } from "@/components/admin/event-schedule/types";

export function Step4DateTime({ data, onChange, isEditable }: Step4DateTimeProps) {
  // Convert EventFormData → EventScheduleItem[]
  const scheduleItems: EventScheduleItem[] = data.dates.map((date, index) => ({
    id: `date-${index}`,
    isMultiDay: false,
    date,
    allDay: data.allDay,
    startTime: data.startTime,
    endTime: data.endTime,
    recurringEnabled: data.repeatEnabled,
    recurrenceInterval: 1,
    recurrenceUnit: data.repeatUnit as any,
    recurrenceUntil: null,
  }));

  const handleScheduleChange = (items: EventScheduleItem[]) => {
    // Convert EventScheduleItem[] → EventFormData
    onChange({
      dates: items.map(item => item.date!).filter(Boolean),
      allDay: items[0]?.allDay || false,
      startTime: items[0]?.startTime || "",
      endTime: items[0]?.endTime || "",
      repeatEnabled: items.some(item => item.recurringEnabled),
      // ... more mappings
    });
  };

  return (
    <div className="space-y-6">
      <h2>Дата и время</h2>
      <EventScheduleList 
        items={scheduleItems} 
        onChange={handleScheduleChange} 
      />
    </div>
  );
}
```

---

## Limitations

### Not Implemented

- ❌ Server integration
- ❌ Autosave
- ❌ Complex recurrence engine (RRULE)
- ❌ Timezone support
- ❌ Date range validation
- ❌ Conflict detection

### Future Enhancements

- Add date range picker for multi-day events
- Add recurrence preview ("Next 5 occurrences")
- Add timezone selector
- Add validation messages
- Add conflict warnings
- Add calendar view

---

## Testing

### Manual Test Checklist

- [ ] Add new date card
- [ ] Remove date card (when multiple exist)
- [ ] Toggle multi-day
- [ ] Select date
- [ ] Toggle all-day (time fields hide/show)
- [ ] Change start/end time
- [ ] Toggle recurring (recurrence block shows/hides)
- [ ] Change recurrence interval
- [ ] Change recurrence unit
- [ ] Select until date
- [ ] Collapse/expand card
- [ ] Collapsed summary displays correctly

---

## Summary

✅ **Created**:
- EventScheduleCard component
- EventScheduleList component
- Type definitions
- UI Lab demo section

✅ **Features**:
- Clean card-based UI
- Collapsible cards
- Multi-day support
- All-day events
- Recurring events
- Add/remove dates
- Responsive layout

✅ **Ready for**:
- Integration into Event Wizard Step 4
- Reuse in other admin forms
- Extension with additional features

The module is production-ready for UI integration. Backend logic (recurrence engine, validation) should be added during Event Wizard integration.
