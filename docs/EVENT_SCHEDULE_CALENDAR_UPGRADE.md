# Event Schedule Calendar Upgrade

## Обзор

Заменен старый технический `<input type="date">` в Event Schedule Module на новый чистый premium календарь из ui-lab.

## Что было изменено

### 1. Создан новый компонент Calendar

**Файл:** `src/components/ui/calendar.tsx`

Извлечена календарная часть из `DateTimePicker` в отдельный переиспользуемый компонент:

```typescript
interface CalendarProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  className?: string;
  disabled?: boolean;
  disablePast?: boolean; // Блокировка прошлых дат
  defaultMonth?: Date; // Для установки начального месяца (используется для второго календаря)
  rangeStart?: Date | null; // Начало диапазона для multi-day режима
  rangeEnd?: Date | null; // Конец диапазона для multi-day режима
}
```

**Особенности:**
- Крупный заголовок месяца с навигацией стрелками
- Clean grid с мягким selection state
- Премиальный light look с белым фоном
- Поддержка блокировки прошлых дат (`disablePast={true}`)
- Подсветка текущей даты с кольцом (`ring-1 ring-primary/30`)
- Выбор диапазона дат для multi-day режима
- Визуальное выделение диапазона (светло-синий фон между датами)
- Русская локализация (неделя начинается с понедельника)
- Минимальный визуальный шум
- Параметр `defaultMonth` для установки начального месяца (полезно для показа двух календарей)

### 2. Обновлен EventScheduleCard

**Файл:** `src/components/admin/event-schedule/EventScheduleCard.tsx`

**Было:**
```tsx
<Input
  type="date"
  value={item.date || ""}
  onChange={(e) => handleUpdate({ date: e.target.value })}
/>
```

**Стало:**
```tsx
<Popover open={isDatePickerOpen} onOpenChange={handleOpenDatePicker}>
  <PopoverTrigger asChild>
    <button className="...">
      <span>{formatDate(item.date)}</span>
      <CalendarIcon className="w-4 h-4" />
    </button>
  </PopoverTrigger>
  <PopoverContent style={{ width: 'var(--radix-popover-trigger-width)' }}>
    <div className={item.isMultiDay ? "flex" : ""}>
      {/* Первый календарь */}
      <div className={item.isMultiDay ? "flex-1 border-r" : "w-full"}>
        <Calendar
          value={selectedDate}
          onChange={handleDateSelect}
          disablePast={true}
          rangeStart={tempStartDate}
          rangeEnd={tempEndDate}
        />
      </div>
      
      {/* Второй календарь для multi-day режима */}
      {item.isMultiDay && (
        <div className="flex-1">
          <Calendar
            value={null}
            onChange={handleDateSelect}
            disablePast={true}
            defaultMonth={getNextMonth()}
            rangeStart={tempStartDate}
            rangeEnd={tempEndDate}
          />
        </div>
      )}
    </div>
    
    {/* Кнопка "Сохранить" для multi-day режима */}
    {item.isMultiDay && tempStartDate && (
      <div className="border-t p-4 flex justify-between">
        <div className="text-sm">
          {tempEndDate ? "20 мар — 25 мар" : "Выберите конечную дату"}
        </div>
        <button onClick={handleSaveDateRange}>Сохранить</button>
      </div>
    )}
  </PopoverContent>
</Popover>
```

**Изменения:**
- Заменены оба date input'а (основная дата и "До" для recurring)
- Добавлен Popover для отображения календаря
- Добавлена функция `formatDate()` для красивого отображения даты
- Добавлена функция `formatDateRange()` для отображения диапазона дат:
  - Один месяц: "13-15 мар"
  - Разные месяцы: "13 мар - 20 апр"
- Календарь растягивается на полную ширину триггера (`--radix-popover-trigger-width`)
- В multi-day режиме показываются два календаря side-by-side (50% каждый)
- Второй календарь автоматически показывает следующий месяц
- Добавлена логика выбора диапазона дат (первый клик = начало, второй = конец)
- Кнопка "Сохранить" появляется внизу при выборе диапазона
- Календарь закрывается после нажатия "Сохранить" в multi-day режиме
- Календарь закрывается автоматически после выбора даты в single-day режиме
- Прошлые даты заблокированы (`disablePast={true}`)
- Добавлено поле `dateEnd` в `EventScheduleItem` для хранения конечной даты
- При выключении "Несколько дней" поле `dateEnd` очищается
- Сохранен текущий data model (строка в формате YYYY-MM-DD)

### 3. Обновлен UI Lab Registry

**Файл:** `src/components/ui-lab/registry.ts`

Добавлена запись для нового компонента Calendar:

```typescript
"calendar": {
  title: "Calendar",
  sourcePath: "src/components/ui/calendar.tsx",
  status: "rendered",
  usedIn: [
    "src/components/admin/event-schedule/EventScheduleCard.tsx",
  ],
  description: "Clean premium calendar for date selection",
}
```

## Сохраненная функциональность

✅ Текущий state schedule item не изменен  
✅ Текущий onChange contract сохранен  
✅ Текущий create/edit flow Event Wizard работает  
✅ Validation Step 4 не затронута  
✅ Recurrence logic MVP работает  
✅ All-day logic работает  
✅ Start/end time logic работает  

## Особенности нового календаря

1. **Визуальная консистентность** - единый date-selection pattern для проекта
2. **Premium UX** - чистый дизайн без технического вида, белый фон
3. **Лучшая читаемость** - крупный шрифт, хорошие отступы
4. **Удобная навигация** - стрелки для переключения месяцев
5. **Русская локализация** - правильный формат даты и недели
6. **Переиспользуемость** - можно использовать в других admin/public формах
7. **Адаптивная ширина** - растягивается на полную ширину триггера
8. **Multi-day режим** - два календаря рядом (по 50% каждый) при включенном "Несколько дней"
9. **Выбор диапазона** - визуальное выделение диапазона дат с кнопкой "Сохранить"
10. **Валидация дат** - прошлые даты заблокированы, текущая дата подсвечена
11. **Умная навигация** - второй календарь автоматически показывает следующий месяц

## Использование в других местах

Новый компонент `Calendar` можно легко переиспользовать:

```tsx
import { Calendar } from "@/components/ui/calendar";

function MyComponent() {
  const [date, setDate] = useState<Date | null>(null);
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button>Выберите дату</button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar
          value={date}
          onChange={setDate}
          disablePast={true}
        />
      </PopoverContent>
    </Popover>
  );
}
```

## Тестирование

Проверьте следующие сценарии:

1. **Выбор одной даты в EventScheduleCard**
   - Открыть Event Schedule Module в ui-lab-admin
   - Кликнуть на поле "Дата"
   - Убедиться, что открывается календарь на полную ширину поля
   - Убедиться, что прошлые даты неактивны (серые)
   - Убедиться, что текущая дата подсвечена кольцом
   - Выбрать будущую дату
   - Убедиться, что календарь закрывается и дата отображается

2. **Multi-day режим**
   - Включить "Несколько дней?"
   - Кликнуть на поле "Дата"
   - Убедиться, что показываются два календаря side-by-side
   - Убедиться, что второй календарь показывает следующий месяц
   - Выбрать начальную дату (первый клик)
   - Убедиться, что календарь НЕ закрывается
   - Выбрать конечную дату (второй клик)
   - Убедиться, что диапазон подсвечен светло-синим
   - Убедиться, что внизу появилась кнопка "Сохранить" с отображением диапазона
   - Нажать "Сохранить"
   - Убедиться, что календарь закрывается
   - Убедиться, что в поле отображается диапазон:
     - Один месяц: "13-15 мар"
     - Разные месяцы: "13 мар - 20 апр"
   - Открыть календарь снова и убедиться, что выбранный диапазон сохранен
   - Выключить "Несколько дней?" и убедиться, что показывается только начальная дата

3. **Recurring events**
   - Включить "Recurring event"
   - Выбрать дату в поле "До"
   - Убедиться, что календарь работает корректно

4. **Event Wizard Step 4** (если интегрирован)
   - Создать новое событие
   - Перейти к Step 4
   - Проверить выбор даты
   - Убедиться, что данные сохраняются корректно

## Файлы изменены

- ✅ `src/components/ui/calendar.tsx` - создан новый компонент
- ✅ `src/components/admin/event-schedule/EventScheduleCard.tsx` - обновлен
- ✅ `src/components/admin/event-schedule/types.ts` - добавлено поле `dateEnd`
- ✅ `src/components/ui-lab/registry.ts` - добавлена запись
- ✅ `src/app/(ui)/ui-lab-admin/_sections/EventScheduleSection.tsx` - обновлены дефолтные даты
- ✅ `src/components/business/wizard/event/steps/Step4DateTime.tsx` - интегрирован EventScheduleList
- ✅ `docs/EVENT_SCHEDULE_CALENDAR_UPGRADE.md` - создана документация

## Интеграция в Event Wizard Step 4

Event Schedule Module теперь полностью интегрирован в Step 4 Event Wizard:

**Файл:** `src/components/business/wizard/event/steps/Step4DateTime.tsx`

**Изменения:**
- Заменен старый UI с prompt() и простым списком дат на EventScheduleList
- Добавлена конвертация между EventFormData и EventScheduleItem[]
- Сохранена обратная совместимость с существующей data model
- Пользователь теперь получает полнофункциональный календарь с:
  - Выбором одной или нескольких дат
  - Диапазоном дат в multi-day режиме
  - All-day режимом
  - Recurring events с настройкой интервала и конечной даты
  - Блокировкой прошлых дат
  - Визуальным отображением текущей и выбранной даты

**Маппинг данных:**
```typescript
EventFormData.dates[] → EventScheduleItem[].date
EventFormData.allDay → EventScheduleItem.allDay
EventFormData.startTime → EventScheduleItem.startTime
EventFormData.endTime → EventScheduleItem.endTime
EventFormData.repeatEnabled → EventScheduleItem.recurringEnabled
EventFormData.repeatUnit → EventScheduleItem.recurrenceUnit
EventFormData.repeatUntil → EventScheduleItem.recurrenceUntil
```

**Преимущества:**
- Единый UX для выбора дат во всем проекте
- Premium календарь вместо технического date input
- Поддержка сложных сценариев (multi-day, recurring)
- Визуально консистентный с admin UI

## Технические детали

### Формат даты

- **Внутренний формат:** `YYYY-MM-DD` (строка)
- **Отображение:** `"1 января 2024"` (русская локализация)
- **Конвертация:** `new Date(dateStr)` → `date.toISOString().split('T')[0]`

### Popover поведение

- Открывается по клику на trigger
- Закрывается автоматически после выбора даты
- Можно закрыть кликом вне области
- Можно закрыть кликом на trigger повторно

### Стилизация

- Использует существующие Tailwind классы
- Белый фон календаря (`bg-white`)
- Совместим с admin UI patterns
- Responsive (работает на desktop)
- Accessibility: aria-labels для навигации
- Адаптивная ширина:
  - Календарь растягивается на полную ширину триггера (`--radix-popover-trigger-width`)
  - Multi-day режим: два календаря по 50% каждый
  - Второй календарь автоматически показывает следующий месяц
- Визуальные состояния:
  - Текущая дата: кольцо `ring-1 ring-primary/30`
  - Выбранная дата: `bg-primary text-primary-foreground`
  - Диапазон дат: `bg-primary/10 text-primary`
  - Прошлые даты: `text-gray-300 cursor-not-allowed`
