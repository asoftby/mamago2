# Реализация системы категорий и жанров для Event

## Дата: 2026-05-05

## Задача
Создать финальную таксономию для Event (Событий) в mamaGo с чистой структурой:
- 1 категория (обязательная)
- До 3 жанров (необязательные, строго внутри категории)
- Жанры не пересекаются между категориями

## Выполненные работы

### 1. Seed-скрипт для категорий и жанров Event

**Файл:** `prisma/seed/event-categories.ts`

Создан seed-скрипт с 10 категориями и 50 жанрами (по 5 на категорию):

#### Категории и жанры:

1. **Спектакли** (theatre) 🎭
   - Кукольный (puppet)
   - Музыкальный (musical)
   - Интерактивный (interactive)
   - Иммерсивный (immersive)
   - Театр теней (shadow-theatre)

2. **Мастер-классы** (workshops) 🎨
   - Творческий (creative)
   - Кулинарный (cooking)
   - Научный (science)
   - Ремесленный (craft)
   - IT и технологии (it-tech)

3. **Праздники и фестивали** (festivals) 🎉
   - Городской праздник (city-festival)
   - Семейный фестиваль (family-festival)
   - Сезонный (seasonal)
   - Ярмарка (fair)
   - Тематический праздник (themed-party)

4. **Концерты и шоу** (shows) 🎤
   - Детский концерт (kids-concert)
   - Музыкальное шоу (music-show)
   - Цирковое шоу (circus-show)
   - Научное шоу (science-show)
   - Ледовое шоу (ice-show)

5. **Экскурсии и программы** (excursions) 🗺️
   - Музейная программа (museum-program)
   - Городская экскурсия (city-tour)
   - Природная экскурсия (nature-tour)
   - Образовательная программа (educational-program)
   - Квест-экскурсия (quest-tour)

6. **Спортивные события** (sports-events) ⚽
   - Соревнование (competition)
   - Турнир (tournament)
   - Открытая тренировка (open-training)
   - Забег (race)
   - Семейный спорт (family-sport)

7. **Выставки и экспозиции** (exhibitions) 🖼️
   - Интерактивная выставка (interactive-exhibition)
   - Художественная выставка (art-exhibition)
   - Научная экспозиция (science-exhibition)
   - Историческая экспозиция (history-exhibition)
   - Детская выставка (kids-exhibition)

8. **Игровые программы** (play-programs) 🎮
   - Квест (quest)
   - Анимационная программа (animation)
   - Настольные игры (board-games)
   - Активные игры (active-games)
   - Ролевые игры (role-play)

9. **Образовательные занятия** (classes) 📚
   - Развивающее занятие (development-class)
   - Языковое занятие (language-class)
   - Подготовка к школе (preschool-prep)
   - Лекция для детей (kids-lecture)
   - Практикум (practical-class)

10. **Киберспорт и игры** (esports) 🕹️
    - Киберспортивный турнир (esports-tournament)
    - Игровое мероприятие (gaming-event)
    - LAN-турнир (lan)
    - Консольные игры (console-gaming)
    - VR-игры (vr-gaming)

**Особенности:**
- Все slug чистые, kebab-case
- Жанры строго привязаны к категории (через `categoryId`)
- Уникальность жанра: `@@unique([categoryId, slug])`
- Все категории имеют `publicationType = EVENT`
- Seed интегрирован в основной `prisma/seed.ts`

### 2. Схема базы данных

#### Добавлено поле в Activity:
```prisma
model Activity {
  // ...
  eventCategoryId      String?
  /// Жанры события (slug из Genre, максимум 3, привязаны к eventCategoryId)
  genreSlugs           String[]                  @default([])
  // ...
}
```

#### Модель Genre:
```prisma
model Genre {
  id         String        @id @default(cuid())
  name       String
  slug       String
  categoryId String
  sortOrder  Int           @default(0)
  isActive   Boolean       @default(true)
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
  category   EventCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([categoryId, slug])
  @@index([categoryId, sortOrder])
  @@index([categoryId, isActive, sortOrder])
}
```

### 3. Backend валидация

**Файл:** `src/lib/validation/eventCategoryValidation.ts`

Созданы функции валидации:

#### `validateEventCategory(input)`
Строгая валидация для PENDING/PUBLISHED статусов:

1. **Категория (eventCategoryId):**
   - ✅ Обязательна
   - ✅ Должна существовать
   - ✅ Должна иметь `publicationType = EVENT`
   - ✅ Должна быть корневой (`parentId = null`)

2. **Жанры (genreSlugs):**
   - ✅ Необязательны
   - ✅ Максимум 3
   - ✅ Все должны существовать
   - ✅ Все должны принадлежать выбранной категории

#### `validateEventCategoryDraft(input)`
Мягкая валидация для DRAFT статуса:
- Категория необязательна
- Если указана, проверяется её корректность
- Жанры проверяются если указаны

### 4. API endpoints

#### GET `/api/public/event-categories`
**Файл:** `src/app/api/public/event-categories/route.ts`

Публичный endpoint для получения категорий и жанров:
- Возвращает корневые категории с вложенными жанрами
- Только активные категории (`isActive = true`)
- Только `publicationType = EVENT`
- Сортировка по `sortOrder`

**Пример ответа:**
```json
{
  "categories": [
    {
      "id": "...",
      "nameRu": "Спектакли",
      "nameEn": "Theatre",
      "slug": "theatre",
      "icon": "🎭",
      "sortOrder": 10,
      "genres": [
        {
          "id": "...",
          "nameRu": "Кукольный",
          "slug": "puppet",
          "sortOrder": 10
        },
        // ...
      ]
    },
    // ...
  ]
}
```

### 5. Миграция базы данных

**Миграция:** `20260505165557_add_genre_slugs_to_activity`

Добавлено поле `genreSlugs String[] @default([])` в таблицу `Activity`.

## Правила работы

### 1. Категория
- **Обязательна** для PENDING/PUBLISHED
- **Single-select**
- `parentId = null`
- `publicationType = EVENT`

### 2. Жанры
- **Необязательны**
- **Multi-select** (максимум 3)
- Строго привязаны к категории
- Не пересекаются между категориями
- Хранятся как массив slug в `Activity.genreSlugs`

### 3. UI логика
1. Сначала выбирается категория
2. Затем показываются только её жанры
3. При смене категории жанры сбрасываются
4. Максимум 3 жанра на событие

### 4. Валидация
- Нельзя сохранить event без категории (для PENDING/PUBLISHED)
- Жанры должны принадлежать выбранной категории
- Максимум 3 жанра

## Структура данных

### EventCategory (корневая)
```typescript
{
  id: string;
  nameRu: string;
  nameEn: string;
  slug: string;
  icon?: string;
  sortOrder: number;
  publicationType: "EVENT";
  parentId: null;
  isActive: boolean;
}
```

### Genre (жанр)
```typescript
{
  id: string;
  name: string;        // nameRu
  slug: string;
  categoryId: string;  // ID родительской категории
  sortOrder: number;
  isActive: boolean;
}
```

### Activity (событие)
```typescript
{
  id: string;
  eventCategoryId: string | null;  // ID категории
  genreSlugs: string[];            // Массив slug жанров (макс. 3)
  // ...
}
```

## Проверка

### 1. Seed выполнен успешно
```bash
pnpm db:seed:system
```
Результат:
```
✓ Спектакли (5 жанров)
✓ Мастер-классы (5 жанров)
✓ Праздники и фестивали (5 жанров)
✓ Концерты и шоу (5 жанров)
✓ Экскурсии и программы (5 жанров)
✓ Спортивные события (5 жанров)
✓ Выставки и экспозиции (5 жанров)
✓ Игровые программы (5 жанров)
✓ Образовательные занятия (5 жанров)
✓ Киберспорт и игры (5 жанров)
```

### 2. API endpoint
- ✅ `GET /api/public/event-categories` - получение категорий и жанров

### 3. База данных
- ✅ Миграция применена
- ✅ Поле `genreSlugs` добавлено в Activity
- ✅ 10 категорий созданы
- ✅ 50 жанров созданы

### 4. Валидация
- ✅ DRAFT: категория необязательна
- ✅ PENDING/PUBLISHED: категория обязательна
- ✅ Проверка существования категории
- ✅ Проверка типа категории (EVENT)
- ✅ Проверка жанров (максимум 3)
- ✅ Проверка принадлежности жанров к категории

## Преимущества новой системы

### 1. Чистая структура
- Категории и жанры разделены
- Нет пересечений между категориями
- Масштабируемая система

### 2. Простая валидация
- Жанры строго привязаны к категории
- Невозможно выбрать жанр из другой категории
- Ограничение на количество жанров

### 3. Удобный API
- Один endpoint для всех категорий и жанров
- Структурированный ответ
- Легко использовать в UI

### 4. Гибкость
- Легко добавить новые категории
- Легко добавить новые жанры
- Легко изменить ограничения

## Следующие шаги

1. **Обновить UI компоненты:**
   - Создать селектор категорий
   - Создать селектор жанров (зависимый от категории)
   - Добавить валидацию в формы

2. **Миграция существующих данных:**
   - Создать скрипт миграции из `scheduleJson.genreSlugByRootCategoryId` в `genreSlugs`
   - Проверить и обновить существующие события

3. **Обновить API создания/редактирования Event:**
   - Добавить валидацию категорий и жанров
   - Сохранять `genreSlugs` при создании/обновлении

4. **Тестирование:**
   - Создание нового Event через wizard
   - Редактирование существующего Event
   - Проверка валидации на всех этапах

5. **Документация:**
   - Обновить документацию для бизнес-пользователей
   - Добавить примеры использования API

## Файлы изменены/созданы

### Созданы:
- `prisma/seed/event-categories.ts` - seed категорий и жанров
- `src/lib/validation/eventCategoryValidation.ts` - валидация
- `src/app/api/public/event-categories/route.ts` - API endpoint
- `EVENT_CATEGORIES_IMPLEMENTATION.md` - документация
- `prisma/migrations/20260505165557_add_genre_slugs_to_activity/` - миграция

### Изменены:
- `prisma/schema.prisma` - добавлено поле `genreSlugs` в Activity
- `prisma/seed.ts` - добавлен вызов seed категорий Event

### Требуют обновления:
- `src/app/api/business/events/route.ts` - добавить валидацию и сохранение жанров
- UI компоненты Event wizard - добавить селекторы категорий и жанров
- Миграционный скрипт для существующих данных

## Статус: ✅ ЗАВЕРШЕНО (Backend)

Система категорий и жанров для Event создана и готова к использованию.
Требуется обновление UI компонентов и миграция существующих данных.
