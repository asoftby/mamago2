# Event Wizard Step 5 Redesign - Complete

## Обзор

Шаг 5 "Стоимость и запись" в Event Wizard был полностью переработан для малого бизнеса с прогрессивным UX.

## Что изменилось

### Старая версия (Step5Price)
- Примитивная структура: цена + ссылка + галка "требуется регистрация"
- Не учитывала разные сценарии взаимодействия
- Слишком простая для реальных бизнес-кейсов

### Новая версия (Step5PricingParticipation)
- Прогрессивный UX с 3 основными блоками
- Поддержка 5 режимов участия
- Интеграция со Schedule Editor для слотов
- Умные подсказки и helper text

## Архитектура нового шага

### 1. Блок "Стоимость" (Pricing Mode)

4 режима:
- **Бесплатно** - без дополнительных полей
- **Фиксированная цена** - поле для ввода цены
- **Цена "от"** - поле для минимальной цены
- **По запросу** - без дополнительных полей

### 2. Блок "Формат участия" (Participation Mode)

5 режимов с прогрессивным раскрытием:

#### info-only (Только информация)
- Событие без записи
- Нет дополнительных полей

#### simple-booking (Простая запись)
- Для простых событий с заявкой
- Поля:
  - Дата события
  - Время события
  - Лимит мест (опционально)
- Helper text объясняет механику

#### time-slots (Запись по времени)
- Для мастер-классов и групповых занятий
- Встроенный Schedule Editor
- Управление датами и слотами
- Автоматический контроль capacity

#### external-link (Покупка билета по ссылке)
- Для событий с внешней продажей билетов
- Поле для ссылки на внешний сайт
- Helper text объясняет механику

#### request (Оставить заявку)
- Для событий с индивидуальным подходом
- Нет дополнительных полей
- Helper text объясняет механику

### 3. Блок "Кнопка действия" (CTA Type)

4 варианта:
- **Записаться** - для booking сценариев
- **Купить билет** - для платных событий
- **Оставить заявку** - для request сценариев
- **Подробнее** - для информационных событий

## Типы данных

### EventFormData (обновлено)

```typescript
interface EventFormData {
  // ... existing fields ...
  
  // Step 5: Pricing & Participation
  pricingMode: "free" | "fixed" | "from" | "on-request";
  price: string;
  ticketLink: string;
  participationMode: "info-only" | "simple-booking" | "time-slots" | "external-link" | "request";
  ctaType: "book" | "buy" | "request" | "details";
  
  // Simple booking fields
  simpleBookingDate: string | null; // YYYY-MM-DD
  simpleBookingTime: string | null; // HH:mm–HH:mm
  simpleBookingCapacity: number | null;
  
  // Time slots (advanced)
  timeSlots: {
    dates: Array<{
      id: string;
      isoDate: string;
      label: string;
      slots: Array<{
        id: string;
        startTime: string;
        endTime: string;
        capacity: number;
      }>;
    }>;
  };
}
```

## Валидация

### isComplete() логика

Шаг считается завершенным, если:
1. Выбран `pricingMode`
2. Если платный режим (fixed/from) - заполнена `price`
3. Выбран `participationMode`
4. Если external-link - заполнена `ticketLink`
5. Если simple-booking - заполнена `simpleBookingDate`
6. Если time-slots - есть хотя бы одна дата со слотами
7. Выбран `ctaType`

### getSummary()

Показывает:
- Стоимость (с учетом режима)
- Формат участия
- Кнопка действия

### getMissingFields()

Возвращает список незаполненных обязательных полей в зависимости от выбранных режимов.

## UX принципы

### Progressive Disclosure
Показываем только релевантные поля для выбранного режима:
- info-only → нет дополнительных полей
- simple-booking → простые поля даты/времени/capacity
- time-slots → полноценный Schedule Editor
- external-link → поле ссылки
- request → нет дополнительных полей

### Visual Hierarchy
- Основные режимы - крупные кнопки
- Детали режима - цветные блоки с border
- Helper text - мелкий текст с объяснением механики

### Color Coding
- Simple booking - синий (blue-50/blue-200)
- Time slots - фиолетовый (purple-50/purple-200)
- External link - зеленый (green-50/green-200)
- Request - желтый (yellow-50/yellow-200)

### Business-Friendly Language
- Не "booking engine", а "простая запись"
- Не "capacity management", а "лимит мест"
- Не "time slot allocation", а "запись по времени"

## Интеграция с Schedule Editor

Для режима `time-slots` используется существующий компонент `ScheduleEditor`:

```tsx
<ScheduleEditor
  value={data.timeSlots}
  onChange={(timeSlots) => onChange({ timeSlots })}
/>
```

Schedule Editor предоставляет:
- Управление датами
- Создание/редактирование/удаление слотов
- Копирование слотов между датами
- Автоматическую сортировку
- Empty states

## Файлы

### Созданные
- `src/components/business/wizard/event/steps/Step5PricingParticipation.tsx` - новый компонент шага

### Обновленные
- `src/components/business/wizard/event/types.ts` - добавлены новые поля
- `src/components/business/wizard/event/defaults.ts` - дефолтные значения для новых полей
- `src/components/business/wizard/event/eventWizardSteps.config.tsx` - обновлена конфигурация Step 5
- `src/components/business/wizard/event/validation.ts` - обновлена валидация Step 5

### Устаревшие (не удалены для backward compatibility)
- `src/components/business/wizard/event/steps/Step5Price.tsx` - старый компонент

## Сценарии использования

### Сценарий 1: Бесплатное информационное событие
1. Pricing: Бесплатно
2. Participation: Только информация
3. CTA: Подробнее
4. Результат: Простая карточка события без записи

### Сценарий 2: Платный мастер-класс с записью
1. Pricing: Фиксированная цена (50 BYN)
2. Participation: Простая запись
3. Дата: 2026-03-20
4. Время: 14:00–16:00
5. Лимит: 15 человек
6. CTA: Записаться
7. Результат: Форма записи с указанием даты/времени/мест

### Сценарий 3: Курс со слотами
1. Pricing: Цена от (30 BYN)
2. Participation: Запись по времени
3. Даты: несколько дат с разными слотами
4. CTA: Записаться
5. Результат: Виджет выбора даты и времени

### Сценарий 4: Событие с внешней продажей
1. Pricing: Фиксированная цена (100 BYN)
2. Participation: Покупка билета по ссылке
3. Ссылка: https://tickets.example.com
4. CTA: Купить билет
5. Результат: Кнопка перехода на внешний сайт

### Сценарий 5: Индивидуальная консультация
1. Pricing: По запросу
2. Participation: Оставить заявку
3. CTA: Оставить заявку
4. Результат: Форма заявки с контактами

## Продуктовые преимущества

### Для малого бизнеса
- Простые события настраиваются за 30-60 секунд
- Понятный язык без технического жаргона
- Прогрессивное раскрытие - не перегружает
- Слоты как advanced-опция, не обязательная

### Для пользователей
- Единообразный UX для разных типов событий
- Понятные CTA кнопки
- Автоматическая генерация booking widget
- Нет путаницы с разными форматами записи

### Для платформы
- Единая архитектура для events/courses/services
- Гибкость без усложнения
- Масштабируемость для будущих режимов
- Чистая типизация и валидация

## Следующие шаги

### Рекомендуется
1. Протестировать все 5 сценариев участия
2. Проверить валидацию на каждом режиме
3. Убедиться, что Schedule Editor корректно интегрирован
4. Проверить mobile responsive для всех блоков

### Опционально
1. Добавить preview виджета справа (как в Activity Form Builder)
2. Добавить quick presets для популярных сценариев
3. Добавить подсказки по выбору оптимального режима
4. Интегрировать с реальным booking API

### Миграция данных
Если есть существующие события с полями `isFree` и `registrationRequired`:
- `isFree: true` → `pricingMode: "free"`
- `isFree: false` + `price` → `pricingMode: "fixed"`
- `registrationRequired: true` → `participationMode: "simple-booking"`
- `registrationRequired: false` → `participationMode: "info-only"`

## Заключение

Новый Step 5 превращает примитивную форму цены в полноценный конфигуратор взаимодействия с пользователями, сохраняя при этом простоту для базовых сценариев и предоставляя мощные возможности для продвинутых кейсов.

Ключевое достижение: **обычные события настраиваются просто, а мастер-классы получают полноценные слоты без усложнения базового flow.**
