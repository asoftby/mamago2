# Schedule Editor Usage Guide

## Overview

UX-first конструктор расписания для mamaGo 2.0. Современный, понятный редактор для создания и управления датами и временными слотами. Не CRM-таблица, а легкий конструктор для бизнеса.

## Demo Location

Полная интерактивная демонстрация доступна в UI Lab Admin:
- URL: `/ui-lab-admin#schedule-editor`
- Секция: "Schedule Editor"

## Key Features

- ✅ Добавление дат через календарь с умным UX
- ✅ Disabled прошлые даты и уже существующие даты
- ✅ Умное копирование слотов при добавлении даты
- ✅ Создание и редактирование слотов
- ✅ Копирование слотов на другие даты
- ✅ Удаление слотов
- ✅ 2-колоночный layout на desktop
- ✅ Вертикальный layout на mobile
- ✅ Empty states для пустых дат
- ✅ Автоматическая сортировка дат и слотов
- ✅ Защита от дублирования дат
- ✅ Блокировка прошлых дат

## Architecture

### Component Structure

```
src/components/schedule-editor/
├── types.ts                  # TypeScript типы
├── mockData.ts              # Mock данные для demo
├── ScheduleEditor.tsx       # Главный контейнер с state
├── ScheduleDateItem.tsx     # Элемент списка дат
├── SlotCard.tsx             # Карточка слота
├── SlotFormDialog.tsx       # Форма добавления/редактирования
└── CopySlotsDialog.tsx      # Диалог копирования слотов
```

### Type Definitions

```typescript
interface ScheduleSlot {
  id: string;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  capacity: number;
}

interface ScheduleDate {
  id: string;
  isoDate: string;   // YYYY-MM-DD
  label: string;     // "18 марта, ср"
  slots: ScheduleSlot[];
}

interface ScheduleEditorValue {
  dates: ScheduleDate[];
}
```

## Basic Usage

### Simple Integration

```tsx
import { ScheduleEditor } from "@/components/schedule-editor/ScheduleEditor";
import { useState } from "react";

function MyComponent() {
  const [schedule, setSchedule] = useState({
    dates: []
  });

  return (
    <ScheduleEditor 
      value={schedule} 
      onChange={setSchedule} 
    />
  );
}
```

### With Initial Data

```tsx
const initialSchedule = {
  dates: [
    {
      id: "date-1",
      isoDate: "2026-03-18",
      label: "18 марта, ср",
      slots: [
        {
          id: "slot-1",
          startTime: "10:00",
          endTime: "10:45",
          capacity: 6,
        },
      ],
    },
  ],
};

<ScheduleEditor value={initialSchedule} onChange={setSchedule} />
```

## User Workflows

### Workflow 1: Adding a Date (Enhanced UX)

1. User clicks "Добавить дату" button
2. Calendar popover opens with:
   - Past dates disabled (grayed out)
   - Already existing dates disabled (grayed out)
3. User selects an available date
4. Date is added to the list and auto-selected
5. Date list is automatically sorted chronologically
6. **Smart Copy Prompt appears** (if previous date has slots):
   - Blue banner shows: "Скопировать слоты с ближайшей даты?"
   - Two options:
     - "Скопировать" - copies slots from nearest previous date
     - "Оставить пустой" - keeps date empty
7. If user chooses to copy, slots are instantly added
8. Prompt disappears after choice is made

### Workflow 2: Adding Slots

1. User selects a date from the list
2. If no slots exist, empty state is shown
3. User clicks "Добавить слот"
4. Dialog opens with form fields:
   - Start time (time picker)
   - End time (time picker)
   - Capacity (number input)
5. User fills form and clicks "Сохранить"
6. Slot is added and list is sorted by time

### Workflow 3: Editing a Slot

1. User clicks edit icon on a slot card
2. Dialog opens pre-filled with slot data
3. User modifies fields
4. User clicks "Сохранить" or "Удалить слот"
5. Changes are applied immediately

### Workflow 4: Copying Slots

1. User selects a date with slots
2. User clicks "Скопировать слоты" button
3. Dialog opens showing:
   - Source date info
   - List of target dates (multiselect)
   - Helper text about append behavior
4. User selects target dates
5. User clicks "Скопировать"
6. Slots are copied with new IDs (append mode)

## Layout Behavior

### Desktop Layout (≥768px)

```
┌─────────────────────────────────────┐
│  Dates List  │  Slots Panel         │
│  (300px)     │  (flex-1)            │
│              │                       │
│  • Date 1    │  Selected Date Title │
│  • Date 2    │  [Copy Slots Button] │
│  • Date 3    │                       │
│              │  Slot 1              │
│  [+ Add]     │  Slot 2              │
│              │  [+ Add Slot]        │
└─────────────────────────────────────┘
```

**Features:**
- 2-column grid layout
- Fixed 300px left sidebar
- Vertical date list
- Full slots panel on right

### Mobile Layout (<768px)

```
┌─────────────────────────┐
│  Даты    [+ Добавить]   │
│  ┌────┬────┬────┐       │
│  │ 18 │ 19 │ 20 │ →     │
│  └────┴────┴────┘       │
│                          │
│  Слоты  [Копировать]    │
│  ┌────────────────────┐ │
│  │ Slot 1             │ │
│  │ Slot 2             │ │
│  └────────────────────┘ │
│  [+ Добавить слот]      │
└─────────────────────────┘
```

**Features:**
- Vertical stacked layout
- Horizontal scrolling date chips
- Compact action buttons
- Touch-friendly spacing

## Empty States

### No Dates

```
┌─────────────────────────┐
│     📅                  │
│  Добавьте первую дату,  │
│  чтобы настроить        │
│  расписание             │
└─────────────────────────┘
```

### No Slots on Selected Date

```
┌─────────────────────────┐
│  На эту дату пока нет   │
│  слотов                 │
│                          │
│  [+ Добавить слот]      │
└─────────────────────────┘
```

## State Management

### Controlled Component

ScheduleEditor is a fully controlled component:

```tsx
// Parent manages state
const [schedule, setSchedule] = useState(initialValue);

// Editor receives value and onChange
<ScheduleEditor 
  value={schedule} 
  onChange={setSchedule} 
/>
```

### Internal State

Editor manages UI state internally:
- Selected date ID
- Dialog open/close states
- Editing slot reference
- Date picker open state

### Data Flow

```
User Action
    ↓
Internal Handler
    ↓
Compute New Value
    ↓
Call onChange(newValue)
    ↓
Parent Updates State
    ↓
Re-render with New Value
```

## Key Behaviors

### Automatic Sorting

**Dates:** Sorted by ISO date (chronological)
```typescript
dates.sort((a, b) => a.isoDate.localeCompare(b.isoDate))
```

**Slots:** Sorted by start time
```typescript
slots.sort((a, b) => a.startTime.localeCompare(b.startTime))
```

### Duplicate Prevention

When adding a date, the editor:
1. Checks if the ISO date already exists
2. Disables that date in the calendar (grayed out, not clickable)
3. Prevents accidental duplicate selection

```typescript
// Existing dates are passed to Calendar
const existingDates = value.dates.map((d) => d.isoDate);

<Calendar
  disabledDates={existingDates}
  // ... other props
/>
```

### Smart Copy on Add

When a new date is added:
1. Editor checks if there's a previous date (chronologically)
2. If previous date has slots, shows inline prompt
3. User can copy slots or skip
4. If copied, slots get new unique IDs
5. Prompt auto-dismisses after choice

**Logic:**
```typescript
const newDateIndex = updatedDates.findIndex((d) => d.id === newDate.id);
if (newDateIndex > 0) {
  const previousDate = updatedDates[newDateIndex - 1];
  if (previousDate.slots.length > 0) {
    setShowCopySlotsPrompt(true);
  }
}
```

### ID Generation

New items get unique IDs:
```typescript
// For dates and slots
id: `date-${Date.now()}`
id: `slot-${Date.now()}`

// For copied slots (ensure uniqueness)
id: `slot-${Date.now()}-${Math.random()}`
```

### Copy Behavior

Slots are copied in **append mode**:
- Existing slots on target date are preserved
- New slots are added to the end
- All slots are re-sorted by time
- Each copied slot gets a new unique ID

## Styling Guidelines

### Date Item States

**Inactive:**
```tsx
bg-white border-gray-200 text-gray-900
```

**Active:**
```tsx
bg-primary/5 border-primary text-primary
```

**Hover:**
```tsx
hover:border-primary/50
```

### Slot Card

```tsx
bg-white border border-gray-200 rounded-lg p-4
hover:border-gray-300
```

### Action Buttons

**Primary (Add Slot):**
```tsx
bg-primary text-primary-foreground hover:bg-primary/90
```

**Secondary (Add Date - dashed):**
```tsx
border-dashed border-gray-300
hover:border-primary hover:text-primary hover:bg-primary/5
```

**Icon Buttons:**
```tsx
// Edit
text-gray-400 hover:text-primary hover:bg-primary/5

// Delete
text-gray-400 hover:text-red-600 hover:bg-red-50
```

## Integration Examples

### In Service Creation Form

```tsx
import { ScheduleEditor } from "@/components/schedule-editor/ScheduleEditor";

function CreateServiceForm() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    schedule: { dates: [] },
  });

  return (
    <form>
      <Input 
        label="Название" 
        value={formData.title}
        onChange={(e) => setFormData({...formData, title: e.target.value})}
      />
      
      <ScheduleEditor
        value={formData.schedule}
        onChange={(schedule) => setFormData({...formData, schedule})}
      />
      
      <button type="submit">Создать услугу</button>
    </form>
  );
}
```

### In Offer Wizard

```tsx
function Step3Schedule({ data, onChange }) {
  return (
    <div className="space-y-6">
      <h2>Настройте расписание</h2>
      
      <ScheduleEditor
        value={data.schedule}
        onChange={(schedule) => onChange({ ...data, schedule })}
      />
    </div>
  );
}
```

### With Validation

```tsx
function validateSchedule(schedule: ScheduleEditorValue): string[] {
  const errors: string[] = [];
  
  if (schedule.dates.length === 0) {
    errors.push("Добавьте хотя бы одну дату");
  }
  
  const datesWithoutSlots = schedule.dates.filter(d => d.slots.length === 0);
  if (datesWithoutSlots.length > 0) {
    errors.push("Некоторые даты не имеют слотов");
  }
  
  return errors;
}

// Usage
const errors = validateSchedule(schedule);
if (errors.length > 0) {
  // Show errors
}
```

## Best Practices

### DO ✅

- Use controlled component pattern
- Validate schedule before submission
- Provide clear empty states
- Show loading states during API calls
- Handle errors gracefully
- Use realistic mock data for testing
- Test on mobile devices

### DON'T ❌

- Don't mutate value prop directly
- Don't skip onChange callback
- Don't add complex validation in editor
- Don't override internal UI state
- Don't remove automatic sorting
- Don't add too many fields to slot form
- Don't make mobile layout cramped

## Accessibility

- All buttons have proper labels
- Dialogs have focus management
- Calendar is keyboard navigable
- Form inputs have labels
- Error states are announced
- Touch targets are 44x44px minimum

## Performance

- Uses React state efficiently
- No unnecessary re-renders
- Dialogs unmount when closed
- Sorting is done on change, not render
- ID generation is fast

## Future Enhancements

Potential features for future versions:
- Recurring slot templates
- Bulk slot generation
- Drag-and-drop slot reordering
- Slot conflict detection
- Time zone support
- Export/import schedule
- Undo/redo functionality

## Files Created

```
src/components/schedule-editor/
├── types.ts
├── mockData.ts
├── ScheduleEditor.tsx
├── ScheduleDateItem.tsx
├── SlotCard.tsx
├── SlotFormDialog.tsx
└── CopySlotsDialog.tsx

src/app/(ui)/ui-lab-admin/_sections/
└── ScheduleEditorSection.tsx

docs/
└── SCHEDULE_EDITOR_USAGE.md
```

## Next Steps

1. Integrate into service/offer creation forms
2. Add backend API integration
3. Implement schedule validation
4. Add booking capacity tracking
5. Create schedule preview component
6. Add export functionality

---

**Created:** March 14, 2026  
**Status:** ✅ Complete - Ready for integration  
**Demo:** `/ui-lab-admin#schedule-editor`
