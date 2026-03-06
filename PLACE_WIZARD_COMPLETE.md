# Place Wizard UI - COMPLETE ✅

## Задача
Создать супер лёгкий UI для добавления Place через wizard с 4 шагами, автосохранением и прогрессом.

## Реализовано

### Структура Routes

```
/business/places/new
  → Создаёт DRAFT через API
  → Редирект на /business/places/[id]/edit?step=1

/business/places/[id]/edit?step=1-4
  → Wizard с 4 шагами
  → Автосохранение
  → Прогресс-бар

/business/places/[id]/submitted
  → Экран успешной отправки
```

### Компоненты

#### PlaceWizard (главный)
- Управление состоянием Place
- Навигация между шагами
- Автосохранение через useAutosave hook
- Оптимистичные обновления
- Submit с валидацией

#### WizardHeader (sticky header)
- Прогресс-бар (1/4, 2/4, 3/4, 4/4)
- Статус места (Черновик, На модерации, и т.д.)
- Индикатор сохранения ("Сохраняю..." / "Сохранено X мин назад")
- Навигация по шагам (Профиль, Локация, Фото, Контакты)

#### Step 1: Профиль
**Реализовано:**
- ✅ Title (обязательно)
- ✅ Category (select, обязательно)
- ✅ ShortDesc (обязательно, 100 символов)
- ✅ Description (textarea, опционально)
  - Показывает 4 строки
  - Кнопка "Показать полностью"
  - Счётчик символов
- ✅ Age tags (chips multi-select)
- ✅ Visit formats (chips multi-select)
- ✅ Activity types (chips multi-select)
- ✅ Кнопка "Далее" (disabled если нет обязательных полей)
- ⏳ Logo upload (TODO)

**Автосохранение:** Все поля с debounce 500ms

#### Step 2: Локация
**Реализовано:**
- ✅ Placeholder для Google Places Autocomplete
- ✅ Placeholder для карты
- ✅ Навигация (Назад/Далее)
- ⏳ Google Places Autocomplete (TODO)
- ⏳ Карта с маркером (TODO)
- ⏳ Manual location (TODO)

#### Step 3: Фото
**Реализовано:**
- ✅ Отображение текущего логотипа
- ✅ Отображение галереи
- ✅ Навигация (Назад/Далее)
- ⏳ Drag & drop upload (TODO)
- ⏳ Reorder (TODO)
- ⏳ Компрессия (TODO)

#### Step 4: Контакты
**Реализовано:**
- ✅ Phone input
- ✅ Website input
- ✅ Instagram input с нормализацией
  - Принимает @handle или URL
  - Нормализует в handle
  - Кнопка "Открыть" для проверки
- ✅ Кнопка "Отправить на модерацию"
- ✅ Submit с валидацией

**Автосохранение:** Все поля с debounce 500ms

### Hooks

#### useAutosave
```typescript
const { updatePlace, isUpdating } = useAutosave(placeId, {
  onSuccess: () => setLastSaved(new Date()),
  debounceMs: 500,
});
```

**Функции:**
- Debounced updates (500ms)
- Автоматическая отправка PATCH запросов
- Индикатор загрузки
- Callbacks для success/error

### Автосохранение

**Как работает:**
1. Пользователь вводит данные
2. Оптимистичное обновление локального state
3. Debounced вызов API (500ms)
4. Индикатор "Сохраняю..."
5. После успеха: "Сохранено X мин назад"

**Что сохраняется:**
- Все текстовые поля (title, description, phone, и т.д.)
- Массивы (ageTags, visitFormats, activityTypes)
- Выбор категории

**Что НЕ сохраняется автоматически:**
- Изображения (требуют отдельного upload)
- Локация (требует отдельного endpoint)

### Валидация

**Lenient (во время редактирования):**
- Можно переходить между шагами
- Предупреждение если нет обязательных полей
- Не блокирует навигацию

**Strict (при submit):**
- Проверка всех обязательных полей
- Показ детальных ошибок
- Блокировка submit если не валидно

### Submit Flow

```typescript
1. Пользователь нажимает "Отправить на модерацию"
2. POST /api/business/places/[id]/submit
3. Если валидация не прошла:
   - Alert с списком ошибок
   - Остаёмся на шаге 4
4. Если успех:
   - Редирект на /business/places/[id]/submitted
   - Показ экрана "На проверке"
```

### Success Page

**Отображает:**
- Иконка (Clock для PENDING, CheckCircle для других)
- Заголовок "Место отправлено на проверку"
- Описание "Мы проверим информацию..."
- Кнопки:
  - "Мои места" → /business/places
  - "На главную" → /business/dashboard

### URL Structure

```
/business/places/new
  → CreatePlaceRedirect (client component)
  → Создаёт DRAFT
  → Редирект на edit?step=1

/business/places/[id]/edit?step=1
  → PlaceWizard
  → Step1Profile

/business/places/[id]/edit?step=2
  → PlaceWizard
  → Step2Location

/business/places/[id]/edit?step=3
  → PlaceWizard
  → Step3Photos

/business/places/[id]/edit?step=4
  → PlaceWizard
  → Step4Contacts

/business/places/[id]/submitted
  → Success page
```

### Прогресс-бар

**Визуализация:**
```
[████████░░░░░░░░] 1/4
Профиль | Локация | Фото | Контакты
  ^
```

**Расчёт:**
```typescript
const progress = (currentStep / totalSteps) * 100;
// Step 1: 25%
// Step 2: 50%
// Step 3: 75%
// Step 4: 100%
```

### Категории

```typescript
const CATEGORIES = [
  { value: "cafe", label: "Кафе и рестораны" },
  { value: "museum", label: "Музеи" },
  { value: "park", label: "Парки и площадки" },
  { value: "kids-center", label: "Детские центры" },
  { value: "theater", label: "Театры" },
  { value: "sport", label: "Спортивные объекты" },
  { value: "entertainment", label: "Развлечения" },
  { value: "education", label: "Образование" },
  { value: "other", label: "Другое" },
];
```

### Tags

**Age Tags:**
- 0-3
- 3-7
- 7-12
- 12+

**Visit Formats:**
- indoor
- outdoor
- online

**Activity Types:**
- sports
- arts
- education
- entertainment
- food

## TODO (следующие итерации)

### Критичные
1. **Logo upload** (Step 1)
   - Crop 1:1
   - Preview circle
   - Компрессия
   - POST /api/business/places/[id]/images

2. **Google Places Autocomplete** (Step 2)
   - Интеграция Google Places API
   - Автокомплит адресов
   - POST /api/business/places/[id]/location/google

3. **Map** (Step 2)
   - Google Maps или Mapbox
   - Маркер на карте
   - Drag marker для точной позиции
   - Manual location fallback

4. **Gallery upload** (Step 3)
   - Drag & drop
   - Multiple files
   - Reorder
   - Компрессия
   - POST /api/business/places/[id]/images

### Улучшения UX
5. **NEEDS_CHANGES banner**
   - Показывать комментарий модератора
   - Кнопка "Исправить и отправить снова"

6. **Validation feedback**
   - Inline ошибки на полях
   - Highlight невалидных шагов

7. **Progress persistence**
   - Сохранять текущий шаг в localStorage
   - Возвращаться на последний шаг при повторном заходе

8. **Image preview**
   - Lightbox для просмотра фото
   - Zoom
   - Навигация между фото

9. **Phone mask**
   - Автоформатирование телефона
   - Валидация формата

10. **Instagram preview**
    - Показывать аватар профиля
    - Проверка существования аккаунта

## Файлы

```
src/app/business/(protected)/places/
├── new/
│   ├── page.tsx                    # Entry point
│   └── CreatePlaceRedirect.tsx     # Client redirect
├── [id]/
│   ├── edit/
│   │   ├── page.tsx                # Wizard page
│   │   ├── PlaceWizard.tsx         # Main wizard component
│   │   ├── components/
│   │   │   └── WizardHeader.tsx    # Sticky header
│   │   ├── hooks/
│   │   │   └── useAutosave.ts      # Autosave hook
│   │   └── steps/
│   │       ├── Step1Profile.tsx    # Step 1
│   │       ├── Step2Location.tsx   # Step 2
│   │       ├── Step3Photos.tsx     # Step 3
│   │       └── Step4Contacts.tsx   # Step 4
│   └── submitted/
│       └── page.tsx                # Success page
└── page.tsx                        # List page
```

## Тестирование

### Manual Testing Checklist

**Step 1: Profile**
- [ ] Ввести title, category, shortDesc
- [ ] Проверить автосохранение (индикатор "Сохраняю...")
- [ ] Проверить счётчик символов
- [ ] Выбрать age tags, visit formats, activity types
- [ ] Нажать "Далее"

**Step 2: Location**
- [ ] Проверить placeholder
- [ ] Нажать "Назад" (вернуться на Step 1)
- [ ] Нажать "Далее"

**Step 3: Photos**
- [ ] Проверить placeholder
- [ ] Навигация Назад/Далее

**Step 4: Contacts**
- [ ] Ввести phone, website
- [ ] Ввести Instagram (@username)
- [ ] Проверить нормализацию (убирает @)
- [ ] Нажать "Открыть" (открывает Instagram)
- [ ] Нажать "Отправить на модерацию"

**Submit**
- [ ] Если валидация не прошла: показать alert
- [ ] Если успех: редирект на submitted page

**Success Page**
- [ ] Показывает правильный статус
- [ ] Кнопки работают

## Известные ограничения

1. **Logo upload не реализован** - показывается placeholder
2. **Google Places не интегрирован** - показывается placeholder
3. **Map не реализована** - показывается placeholder
4. **Gallery upload не реализован** - показывается placeholder
5. **Компрессия изображений** - нужна отдельная реализация
6. **NEEDS_CHANGES banner** - не показывается
7. **Inline validation** - только на submit

## Следующие шаги

1. Реализовать image upload endpoint
2. Интегрировать Google Places Autocomplete
3. Добавить карту (Google Maps / Mapbox)
4. Реализовать gallery upload с drag & drop
5. Добавить компрессию изображений
6. Улучшить валидацию (inline errors)
7. Добавить NEEDS_CHANGES banner

---

**Дата**: 2026-03-04  
**Статус**: ✅ MVP COMPLETE (с TODO для полной функциональности)
