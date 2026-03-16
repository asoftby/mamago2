# Schedule Editor UX Improvements - Implementation Guide

## Обзор

Улучшение UX кнопки "Добавить дату" в Schedule Editor для более быстрого добавления нескольких дат.

## Проблема

Сейчас кнопка "Добавить дату" открывает календарь для выбора одной даты. Бизнес часто добавляет несколько дат сразу (каждую субботу, несколько дней подряд и т.д.).

## Решение

### 1. Popover с выбором действия

**Вместо прямого открытия календаря:**
```tsx
<PopoverTrigger>
  <button>+ Добавить дату</button>
</PopoverTrigger>
<PopoverContent>
  <Calendar /> // Прямо календарь
</PopoverContent>
```

**Сделать:**
```tsx
<PopoverTrigger>
  <button>+ Добавить дату</button>
</PopoverTrigger>
<PopoverContent>
  <div className="p-2 space-y-1">
    <button onClick={() => setMode('single')}>
      <Calendar className="w-4 h-4" />
      Выбрать дату
    </button>
    <button onClick={() => setMode('multiple')}>
      <CalendarDays className="w-4 h-4" />
      Выбрать несколько дат
    </button>
  </div>
</PopoverContent>
```

### 2. Single Date Picker

При клике на "Выбрать дату":
- Открыть обычный Calendar
- Выбор одной даты
- Автоматическое закрытие после выбора

```tsx
{mode === 'single' && (
  <Calendar
    value={null}
    onChange={(date) => {
      handleAddDate(date);
      setIsPopoverOpen(false);
    }}
    disablePast={true}
    disabledDates={existingDates}
  />
)}
```

### 3. Multi Date Picker

При клике на "Выбрать несколько дат":
- Открыть Calendar с режимом multiple selection
- Можно выбрать несколько дат
- Кнопка "Добавить X дат" внизу
- Закрытие по клику на кнопку

```tsx
{mode === 'multiple' && (
  <div>
    <Calendar
      mode="multiple"
      selected={selectedDates}
      onSelect={setSelectedDates}
      disablePast={true}
      disabledDates={existingDates}
    />
    <div className="p-3 border-t">
      <button onClick={handleAddMultipleDates}>
        Добавить {selectedDates.length} дат
      </button>
    </div>
  </div>
)}
```

### 4. Обновить Calendar компонент

Текущий Calendar поддерживает только single selection. Нужно добавить:

```tsx
interface CalendarProps {
  mode?: 'single' | 'multiple';
  selected?: Date | Date[];
  onSelect?: (dates: Date | Date[]) => void;
  // ... existing props
}
```

**Для multiple mode:**
- Клик на дату добавляет/удаляет из массива
- Выбранные даты подсвечиваются
- Можно выбрать несколько дат за один раз

### 5. Автосортировка и активация

После добавления дат:
```tsx
const handleAddMultipleDates = () => {
  const newDates = selectedDates.map(date => ({
    id: `date-${Date.now()}-${Math.random()}`,
    isoDate: date.toISOString().split('T')[0],
    label: formatDateLabel(date),
    slots: [],
  }));

  const updatedDates = [...value.dates, ...newDates].sort((a, b) => 
    a.isoDate.localeCompare(b.isoDate)
  );

  onChange({ dates: updatedDates });
  
  // Активировать первую добавленную дату
  setSelectedDateId(newDates[0].id);
  setNewlyAddedDateId(newDates[0].id);
  
  // Показать prompt для копирования слотов
  if (hasExistingSlotsInPreviousDates()) {
    setShowCopySlotsPrompt(true);
  }
};
```

### 6. Улучшить текст "Нет слотов" → "0 слотов"

**В ScheduleDateItem.tsx:**
```tsx
// БЫЛО:
{date.slots.length === 0 ? "Нет слотов" : `${date.slots.length} слотов`}

// СТАЛО:
{date.slots.length} {getSlotsLabel(date.slots.length)}
```

**Helper:**
```tsx
function getSlotsLabel(count: number): string {
  if (count === 1) return "слот";
  if (count >= 2 && count <= 4) return "слота";
  return "слотов";
}
```

### 7. Улучшить кнопку добавления слота

**В slots panel:**
```tsx
{selectedDate.slots.length === 0 ? (
  <button>
    <Plus />
    Добавить слот
  </button>
) : (
  <button>
    <Plus />
    Добавить ещё слот
  </button>
)}
```

### 8. Prompt для копирования слотов

Уже реализовано, но улучшить текст:
```tsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <p>Скопировать слоты с ближайшей даты?</p>
  <div className="flex gap-2">
    <button onClick={handleCopySlotsFromPrevious}>
      Скопировать
    </button>
    <button onClick={handleSkipCopySlots}>
      Начать с пустой
    </button>
  </div>
</div>
```

## Структура компонента

```tsx
export function ScheduleEditor() {
  const [datePickerMode, setDatePickerMode] = useState<'menu' | 'single' | 'multiple'>('menu');
  const [selectedDatesForAdd, setSelectedDatesForAdd] = useState<Date[]>([]);
  const [isAddDatePopoverOpen, setIsAddDatePopoverOpen] = useState(false);

  return (
    <div>
      {/* Date List */}
      <div>
        {/* ... existing dates ... */}
        
        <Popover open={isAddDatePopoverOpen} onOpenChange={setIsAddDatePopoverOpen}>
          <PopoverTrigger>
            <button>+ Добавить дату</button>
          </PopoverTrigger>
          <PopoverContent>
            {datePickerMode === 'menu' && (
              <AddDateMenu 
                onSelectSingle={() => setDatePickerMode('single')}
                onSelectMultiple={() => setDatePickerMode('multiple')}
              />
            )}
            
            {datePickerMode === 'single' && (
              <SingleDatePicker 
                onSelect={handleAddSingleDate}
                existingDates={existingDates}
              />
            )}
            
            {datePickerMode === 'multiple' && (
              <MultiDatePicker 
                selected={selectedDatesForAdd}
                onSelect={setSelectedDatesForAdd}
                onConfirm={handleAddMultipleDates}
                existingDates={existingDates}
              />
            )}
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Slots Panel */}
      <div>
        {/* ... existing slots ... */}
      </div>
    </div>
  );
}
```

## Новые компоненты

### AddDateMenu.tsx
```tsx
interface AddDateMenuProps {
  onSelectSingle: () => void;
  onSelectMultiple: () => void;
}

export function AddDateMenu({ onSelectSingle, onSelectMultiple }: AddDateMenuProps) {
  return (
    <div className="p-2 space-y-1 min-w-[200px]">
      <button
        onClick={onSelectSingle}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
      >
        <Calendar className="w-4 h-4 text-gray-600" />
        <div>
          <div className="text-sm font-medium text-gray-900">
            Выбрать дату
          </div>
          <div className="text-xs text-gray-500">
            Добавить одну дату
          </div>
        </div>
      </button>
      
      <button
        onClick={onSelectMultiple}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
      >
        <CalendarDays className="w-4 h-4 text-gray-600" />
        <div>
          <div className="text-sm font-medium text-gray-900">
            Выбрать несколько дат
          </div>
          <div className="text-xs text-gray-500">
            Добавить несколько дат сразу
          </div>
        </div>
      </button>
    </div>
  );
}
```

### MultiDatePicker.tsx
```tsx
interface MultiDatePickerProps {
  selected: Date[];
  onSelect: (dates: Date[]) => void;
  onConfirm: () => void;
  existingDates: string[];
}

export function MultiDatePicker({ 
  selected, 
  onSelect, 
  onConfirm, 
  existingDates 
}: MultiDatePickerProps) {
  return (
    <div className="p-0">
      <div className="p-4">
        <Calendar
          mode="multiple"
          selected={selected}
          onSelect={onSelect}
          disablePast={true}
          disabledDates={existingDates}
        />
      </div>
      
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onConfirm}
          disabled={selected.length === 0}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          Добавить {selected.length > 0 ? `${selected.length} дат` : 'даты'}
        </button>
      </div>
    </div>
  );
}
```

## Обновления Calendar компонента

**src/components/ui/calendar.tsx:**

Добавить поддержку multiple selection:

```tsx
interface CalendarProps {
  mode?: 'single' | 'multiple';
  value?: Date | null; // for single mode
  selected?: Date[]; // for multiple mode
  onChange?: (date: Date) => void; // for single mode
  onSelect?: (dates: Date[]) => void; // for multiple mode
  // ... existing props
}

export function Calendar({ 
  mode = 'single',
  value,
  selected = [],
  onChange,
  onSelect,
  ...props 
}: CalendarProps) {
  const handleDayClick = (date: Date) => {
    if (mode === 'single') {
      onChange?.(date);
    } else {
      // Toggle date in array
      const dateStr = date.toISOString().split('T')[0];
      const isSelected = selected.some(d => 
        d.toISOString().split('T')[0] === dateStr
      );
      
      if (isSelected) {
        onSelect?.(selected.filter(d => 
          d.toISOString().split('T')[0] !== dateStr
        ));
      } else {
        onSelect?.([...selected, date]);
      }
    }
  };

  const isDaySelected = (date: Date) => {
    if (mode === 'single') {
      return value?.toISOString().split('T')[0] === date.toISOString().split('T')[0];
    } else {
      return selected.some(d => 
        d.toISOString().split('T')[0] === date.toISOString().split('T')[0]
      );
    }
  };

  // ... rest of implementation
}
```

## Визуальное представление

### До
```
┌─────────────────────────────────────┐
│ Даты                                │
│                                     │
│ [+ Добавить дату] ← Открывает календарь
└─────────────────────────────────────┘
```

### После
```
┌─────────────────────────────────────┐
│ Даты                                │
│                                     │
│ [+ Добавить дату] ← Открывает меню
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📅 Выбрать дату                 │ │
│ │    Добавить одну дату           │ │
│ ├─────────────────────────────────┤ │
│ │ 📅📅 Выбрать несколько дат      │ │
│ │      Добавить несколько дат...  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Multi Date Picker
```
┌─────────────────────────────────────┐
│        Март 2026                    │
│                                     │
│  Пн  Вт  Ср  Чт  Пт  Сб  Вс        │
│                      1   2          │
│   3   4  [5]  6   7  [8]  9        │ ← Выбранные даты
│  10  11  12  13  14 [15] 16        │
│  17  18  19  20  21  22  23        │
│                                     │
├─────────────────────────────────────┤
│ [Добавить 3 даты]                   │
└─────────────────────────────────────┘
```

## Преимущества

1. **Быстрое добавление** - можно добавить несколько дат за один раз
2. **Гибкость** - выбор между одной датой и несколькими
3. **Понятный UX** - меню с описанием действий
4. **Сохранение архитектуры** - не превращается в большой календарь
5. **Автосортировка** - даты всегда в хронологическом порядке
6. **Умное копирование** - предложение скопировать слоты

## Файлы для изменения

1. **src/components/schedule-editor/ScheduleEditor.tsx** - основной компонент
2. **src/components/ui/calendar.tsx** - добавить multiple mode
3. **src/components/schedule-editor/AddDateMenu.tsx** - новый компонент
4. **src/components/schedule-editor/MultiDatePicker.tsx** - новый компонент
5. **src/components/schedule-editor/ScheduleDateItem.tsx** - изменить "Нет слотов" → "0 слотов"

## Тестирование

- [ ] Меню открывается по клику на "Добавить дату"
- [ ] Single date picker работает
- [ ] Multi date picker позволяет выбрать несколько дат
- [ ] Даты автоматически сортируются
- [ ] Первая добавленная дата становится активной
- [ ] Prompt копирования слотов показывается
- [ ] "0 слотов" вместо "Нет слотов"
- [ ] "Добавить ещё слот" когда есть слоты
- [ ] Mobile responsive работает

## Заключение

Эти улучшения сделают добавление дат быстрее и удобнее, особенно для бизнеса, который проводит регулярные мероприятия.
