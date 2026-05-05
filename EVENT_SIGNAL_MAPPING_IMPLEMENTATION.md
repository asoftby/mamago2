# Реализация mapping Event categories/genres → signals

## Дата: 2026-05-05

## Задача
Добавить mapping между Event categories/genres и Discovery/Profile signals для умной автоматической разметки событий.

## Цель
При выборе категории/жанров Event автоматически предлагать связанные signals для:
- Рекомендаций
- Фильтров
- Персонализации
- "Реши за меня"
- My Plan

## Выполненные работы

### 1. Сервис mapping

**Файл:** `src/lib/event/eventSignalMapping.ts`

Создан сервис с полным mapping всех категорий и жанров на signals:

#### Функции:

**`getSuggestedEventSignals(categorySlug, genreSlugs)`**
- Возвращает suggested signal slugs на основе категории и жанров
- Удаляет дубликаты
- Группирует по типам (activity, format, intention, interests)

**`resolveSignalSlugsToIds(slugs, prisma)`**
- Преобразует signal slugs в IDs
- Проверяет активность signals

**`getSuggestedEventSignalIds(categorySlug, genreSlugs, prisma)`**
- Получает все suggested signal IDs для события
- Готовый результат для сохранения в БД

**`validateEventSignals(signalIds, prisma)`**
- Валидация Event signals
- Проверка статуса (ACTIVE)
- Проверка domain и entityTypes
- Блокировка Recommendation signals

### 2. Mapping структура

#### Категории → Signals

Каждая категория имеет базовый набор signals:

```typescript
{
  activitySignalSlugs: string[];    // Чем будут заниматься
  formatSignalSlugs: string[];      // Где проходит
  intentionSignalSlugs: string[];   // Для чего подходит
  interestSignalSlugs: string[];    // Интересы
}
```

**Примеры:**

**Спектакли (theatre):**
- activity: entertainment, calm, creative
- format: indoor
- interests: (зависит от жанра)

**Мастер-классы (workshops):**
- activity: creative, educational, social
- format: indoor
- interests: (зависит от жанра)

**Спортивные события (sports-events):**
- activity: active
- format: outdoor
- interests: sport

#### Жанры → Дополнительные Signals

Жанры добавляют или уточняют signals:

**Примеры:**

**puppet (кукольный спектакль):**
- interests: +creativity

**cooking (кулинарный мастер-класс):**
- activity: +food, +creative

**science-show (научное шоу):**
- activity: +educational
- interests: +science

**vr-gaming (VR-игры):**
- interests: +technology

### 3. API Endpoints

#### GET `/api/events/suggested-signals`

Возвращает suggested signals для события.

**Query params:**
- `categorySlug` - slug категории
- `genreSlugs` - comma-separated список slug жанров

**Response:**
```json
{
  "suggested": {
    "activitySignals": [
      {
        "id": "...",
        "slug": "activity-entertainment",
        "title": "Развлечения",
        "domain": "DISCOVERY"
      }
    ],
    "formatSignals": [...],
    "intentionSignals": [...],
    "interestSignals": [...]
  }
}
```

**Пример запроса:**
```
GET /api/events/suggested-signals?categorySlug=theatre&genreSlugs=puppet,musical
```

#### GET `/api/events/available-signals`

Возвращает все доступные signals для ручного выбора.

**Response:**
```json
{
  "activitySignals": [...],
  "formatSignals": [...],
  "intentionSignals": [...],
  "interestSignals": [...]
}
```

### 4. Обновление API создания Event

**Файл:** `src/app/api/business/events/route.ts`

Добавлена обработка signals:

1. **Валидация signals:**
   - Проверка существования
   - Проверка статуса (ACTIVE)
   - Проверка domain и entityTypes
   - Блокировка Recommendation signals

2. **Сохранение:**
   - `discoverySignalIds` - массив ID signals
   - `genreSlugs` - массив slug жанров (макс. 3)
   - Удаление дубликатов

3. **Обработка жанров:**
   - Максимум 3 жанра
   - Валидация принадлежности к категории

## Mapping таблица

### Категории

| Категория | Activity | Format | Interests |
|-----------|----------|--------|-----------|
| Спектакли | entertainment, calm, creative | indoor | - |
| Мастер-классы | creative, educational, social | indoor | - |
| Праздники и фестивали | entertainment, social | outdoor | - |
| Концерты и шоу | entertainment, calm | indoor | - |
| Экскурсии | educational, calm | outdoor | - |
| Спортивные события | active | outdoor | sport |
| Выставки | calm, educational | indoor | - |
| Игровые программы | entertainment, active, social | indoor | - |
| Образовательные занятия | educational | indoor | - |
| Киберспорт | entertainment, educational, social | indoor | technology |

### Жанры (примеры)

| Жанр | Дополнительные signals |
|------|------------------------|
| puppet | interests: creativity |
| musical | interests: music |
| cooking | activity: food, creative |
| science | activity: educational; interests: science |
| it-tech | activity: educational; interests: technology |
| circus-show | activity: entertainment, active |
| nature-tour | format: outdoor; interests: nature |
| vr-gaming | interests: technology |

## UI Flow

### 1. Выбор категории и жанров

Пользователь выбирает:
1. Категорию (обязательно)
2. До 3 жанров (необязательно)

### 2. Автоматическое определение signals

После выбора категории/жанров:
1. Вызывается `GET /api/events/suggested-signals`
2. Получаются suggested signals
3. Показывается блок "Определено автоматически"

### 3. Редактирование signals

Пользователь может:
- ✅ Оставить автоматически предложенные
- ✅ Снять лишние
- ✅ Добавить вручную из доступных

### 4. Сохранение

При сохранении Event:
- Валидируются выбранные signals
- Сохраняются в `discoverySignalIds`
- Жанры сохраняются в `genreSlugs`

## Валидация

### Discovery Signals
- ✅ `status = ACTIVE`
- ✅ `domain = DISCOVERY`
- ✅ `entityTypes` includes `EVENT`

### Profile Interests
- ✅ `status = ACTIVE`
- ✅ `domain = PROFILE`
- ✅ `entityTypes` includes `USER`

### Recommendation Signals
- ❌ Не сохраняются вручную
- ❌ Вычисляются автоматически (energy/tempo)

## Преимущества

### 1. Умная автоматизация
- Автоматическое предложение signals
- Экономия времени редактора
- Консистентность данных

### 2. Гибкость
- Можно редактировать автоматические предложения
- Можно добавлять вручную
- Можно снимать лишние

### 3. Масштабируемость
- Легко добавить новые категории
- Легко добавить новые жанры
- Легко обновить mapping

### 4. Рекомендации
- События получают семантическую разметку
- "Реши за меня" понимает смысл события
- Фильтры работают по намерению/активности

## Примеры использования

### Пример 1: Кукольный спектакль

**Выбор:**
- Категория: Спектакли (theatre)
- Жанр: Кукольный (puppet)

**Suggested signals:**
- Activity: entertainment, calm, creative
- Format: indoor
- Interests: creativity

**Результат:**
Событие подходит для:
- Семейного досуга
- Спокойного времяпрепровождения
- Развития творческих способностей

### Пример 2: Научное шоу

**Выбор:**
- Категория: Концерты и шоу (shows)
- Жанр: Научное шоу (science-show)

**Suggested signals:**
- Activity: entertainment, calm, educational
- Format: indoor
- Interests: science

**Результат:**
Событие подходит для:
- Образовательного досуга
- Развития интереса к науке
- Семейного времяпрепровождения

### Пример 3: Кулинарный мастер-класс

**Выбор:**
- Категория: Мастер-классы (workshops)
- Жанр: Кулинарный (cooking)

**Suggested signals:**
- Activity: creative, educational, social, food
- Format: indoor
- Interests: (можно добавить вручную)

**Результат:**
Событие подходит для:
- Творческого досуга
- Обучения кулинарии
- Социального взаимодействия
- Гастрономических интересов

## Следующие шаги

### 1. UI компоненты (приоритет)
- [ ] Блок "Определено автоматически"
- [ ] Селектор signals с группировкой
- [ ] Визуальное отображение suggested signals
- [ ] Возможность редактирования

### 2. Тестирование
- [ ] Проверка mapping для всех категорий
- [ ] Проверка валидации signals
- [ ] Проверка сохранения в БД

### 3. Документация для редакторов
- [ ] Что такое signals
- [ ] Как они влияют на рекомендации
- [ ] Когда редактировать вручную

### 4. Аналитика
- [ ] Отслеживание использования suggested signals
- [ ] Отслеживание ручных изменений
- [ ] Оптимизация mapping на основе данных

## Файлы созданы/изменены

### Созданы:
- `src/lib/event/eventSignalMapping.ts` - сервис mapping
- `src/app/api/events/suggested-signals/route.ts` - API suggested signals
- `src/app/api/events/available-signals/route.ts` - API available signals
- `EVENT_SIGNAL_MAPPING_IMPLEMENTATION.md` - документация

### Изменены:
- `src/app/api/business/events/route.ts` - добавлена обработка signals

### Требуют создания:
- UI компоненты для отображения и редактирования signals
- Тесты для mapping
- Документация для редакторов

## Статус: ✅ ЗАВЕРШЕНО (Backend)

Backend для mapping Event categories/genres → signals реализован и готов к использованию.
Требуется создание UI компонентов для работы с signals в Event wizard.

## Команды для проверки

### Получить suggested signals
```bash
curl "http://localhost:3000/api/events/suggested-signals?categorySlug=theatre&genreSlugs=puppet,musical" | jq
```

### Получить available signals
```bash
curl "http://localhost:3000/api/events/available-signals" | jq
```

### Создать Event с signals
```bash
curl -X POST http://localhost:3000/api/business/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Кукольный спектакль",
    "eventCategoryId": "...",
    "genreSlugs": ["puppet"],
    "discoverySignalIds": ["...", "..."]
  }'
```
