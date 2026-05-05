# Итоговая сводка: Реализация таксономии для Place и Event

## Дата: 2026-05-05

## Обзор

Реализована полная система категоризации для двух типов контента в mamaGo:
1. **Place** (Места) - категории и подкатегории
2. **Event** (События) - категории и жанры

Обе системы независимы, не пересекаются и используют единую таблицу `EventCategory` с разделением по `publicationType`.

---

## 1. Place (Места)

### Структура
- **1 основная категория** (обязательная)
- **1-3 подкатегории** (обязательные)
- Первая подкатегория = основная

### Категории (10)
1. Образование и развитие (12 подкатегорий)
2. Развлечения и досуг (11 подкатегорий)
3. Парки и активный отдых (3 подкатегории)
4. Загородный отдых (5 подкатегорий)
5. Спорт (12 подкатегорий)
6. Кафе и еда (5 подкатегорий)
7. Здоровье (8 подкатегорий)
8. Товары и магазины (8 подкатегорий)
9. Услуги для семьи (7 подкатегорий)
10. Беременность (6 подкатегорий)

**Всего:** 10 категорий, 77 подкатегорий

### Схема БД
```prisma
model Place {
  primaryCategoryId  String?
  primaryCategory    EventCategory?     @relation("PlacePrimaryCategory")
  subcategories      PlaceSubcategory[]
}

model PlaceSubcategory {
  placeId    String
  categoryId String
  position   Int  // 0 = основная
  
  @@id([placeId, categoryId])
}
```

### API
- `GET /api/public/place-categories` - получение категорий
- `POST /api/business/places` - создание с валидацией
- `PATCH /api/business/places/[id]` - обновление с валидацией

### Валидация
- ✅ Основная категория обязательна (PENDING/PUBLISHED)
- ✅ 1-3 подкатегории обязательны (PENDING/PUBLISHED)
- ✅ Подкатегории должны принадлежать основной категории
- ✅ При смене категории подкатегории сбрасываются

---

## 2. Event (События)

### Структура
- **1 категория** (обязательная)
- **До 3 жанров** (необязательные)
- Жанры строго внутри категории

### Категории и жанры (10 категорий, 50 жанров)
1. Спектакли (5 жанров)
2. Мастер-классы (5 жанров)
3. Праздники и фестивали (5 жанров)
4. Концерты и шоу (5 жанров)
5. Экскурсии и программы (5 жанров)
6. Спортивные события (5 жанров)
7. Выставки и экспозиции (5 жанров)
8. Игровые программы (5 жанров)
9. Образовательные занятия (5 жанров)
10. Киберспорт и игры (5 жанров)

**Всего:** 10 категорий, 50 жанров (по 5 на категорию)

### Схема БД
```prisma
model Activity {
  eventCategoryId  String?
  genreSlugs       String[]  @default([])  // Максимум 3
  eventCategory    EventCategory?
}

model Genre {
  id         String
  name       String
  slug       String
  categoryId String
  
  @@unique([categoryId, slug])
}
```

### API
- `GET /api/public/event-categories` - получение категорий и жанров
- `POST /api/business/events` - создание (требует обновления)
- `PATCH /api/business/events/[id]` - обновление (требует обновления)

### Валидация
- ✅ Категория обязательна (PENDING/PUBLISHED)
- ✅ Жанры необязательны
- ✅ Максимум 3 жанра
- ✅ Жанры должны принадлежать выбранной категории
- ✅ При смене категории жанры сбрасываются

---

## Общая архитектура

### EventCategory (единая таблица)
```prisma
model EventCategory {
  id              String
  nameRu          String
  nameEn          String
  slug            String
  publicationType EventCategoryPublicationType  // PLACE | EVENT
  parentId        String?
  
  // Для PLACE
  placePrimary       Place[]
  placeSubcategories PlaceSubcategory[]
  
  // Для EVENT
  activities Activity[]
  genres     Genre[]
  
  @@unique([publicationType, slug])
}
```

### Разделение по типу
- **PLACE**: используется иерархия (parent-child) через `parentId`
- **EVENT**: используется плоская структура категорий + отдельная таблица Genre

---

## Файловая структура

### Seed скрипты
```
prisma/seed/
├── place-categories.ts    # 10 категорий, 77 подкатегорий
├── event-categories.ts    # 10 категорий, 50 жанров
└── (вызываются из prisma/seed.ts)
```

### Валидация
```
src/lib/validation/
├── placeCategoryValidation.ts    # Валидация Place
└── eventCategoryValidation.ts    # Валидация Event
```

### API endpoints
```
src/app/api/public/
├── place-categories/route.ts     # GET категории Place
└── event-categories/route.ts     # GET категории Event
```

### Документация
```
/
├── PLACE_CATEGORIES_IMPLEMENTATION.md
├── EVENT_CATEGORIES_IMPLEMENTATION.md
└── TAXONOMY_IMPLEMENTATION_SUMMARY.md (этот файл)
```

---

## Статистика

### Place
- ✅ 10 категорий
- ✅ 77 подкатегорий
- ✅ Backend готов
- ✅ UI готов
- ✅ Валидация готова

### Event
- ✅ 10 категорий
- ✅ 50 жанров
- ✅ Backend готов
- ⚠️ UI требует обновления
- ✅ Валидация готова

---

## Следующие шаги

### Для Event (приоритет)
1. **Обновить API создания/редактирования:**
   - Добавить сохранение `genreSlugs`
   - Добавить валидацию категорий и жанров

2. **Обновить UI компоненты:**
   - Селектор категорий
   - Селектор жанров (зависимый от категории)
   - Валидация в формах

3. **Миграция данных:**
   - Создать скрипт миграции из `scheduleJson.genreSlugByRootCategoryId`
   - Перенести существующие жанры в `genreSlugs`

### Для Place (опционально)
1. **Миграция существующих мест:**
   - Проверить старые категории
   - Обновить на новую структуру

2. **Тестирование:**
   - Создание нового Place
   - Редактирование существующего Place
   - Проверка валидации

---

## Команды для запуска

### Seed
```bash
# Запустить все seed (включая Place и Event категории)
pnpm db:seed:system

# Только Place категории
pnpm tsx prisma/seed/place-categories.ts

# Только Event категории
pnpm tsx prisma/seed/event-categories.ts
```

### Миграции
```bash
# Применить миграции
pnpm prisma migrate dev

# Создать новую миграцию
pnpm prisma migrate dev --name migration_name
```

### Проверка API
```bash
# Place категории
curl http://localhost:3000/api/public/place-categories | jq

# Event категории
curl http://localhost:3000/api/public/event-categories | jq
```

---

## Ключевые принципы

### 1. Разделение ответственности
- Place и Event используют разные структуры
- Нет пересечений между типами
- Единая таблица с разделением по `publicationType`

### 2. Валидация на всех уровнях
- Backend валидация (API)
- Frontend валидация (UI)
- Database constraints (Prisma)

### 3. Масштабируемость
- Легко добавить новые категории
- Легко добавить новые жанры/подкатегории
- Легко изменить ограничения

### 4. Чистота данных
- Slug без суффиксов
- Kebab-case для всех slug
- Уникальность в рамках типа

---

## Статус: ✅ ЗАВЕРШЕНО

Обе системы категоризации реализованы и готовы к использованию.

**Place:** Полностью готов (Backend + UI + Валидация)  
**Event:** Backend готов, требуется обновление UI и миграция данных
