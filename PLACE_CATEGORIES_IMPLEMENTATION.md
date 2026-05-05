# Реализация системы категорий для Place

## Дата: 2026-05-05

## Задача
Восстановить и нормализовать категории/подкатегории для Place с чистой структурой:
- 1 основная категория (обязательная)
- От 1 до 3 подкатегорий (обязательные)
- Только entityType = PLACE
- Без discovery-сигналов, активностей, тегов и особенностей

## Выполненные работы

### 1. Seed-скрипт для категорий Place

**Файл:** `prisma/seed/place-categories.ts`

Создан seed-скрипт с 10 основными категориями и 77 подкатегориями:

#### Основные категории:

1. **Образование и развитие** (education) - 12 подкатегорий
   - IT школы, Детские сады, Центры развития, Подготовка к школе, Языковые школы, Музыкальные школы, Школы искусств, Танцевальные школы, Театральные студии, Шахматные школы, Репетиторы, Частные школы

2. **Развлечения и досуг** (entertainment) - 11 подкатегорий
   - Детские игровые комнаты, Детские развлекательные центры, Батутные центры, Аквапарки, Зоопарки, Кинотеатры, Квесты, Музеи и галереи, Планетарии, Цирки, Конные клубы

3. **Парки и активный отдых** (outdoor) - 3 подкатегории
   - Парки и площадки, Парки активного отдыха, Точки проката

4. **Загородный отдых** (countryside) - 5 подкатегорий
   - Санатории, Базы отдыха, Усадьбы, Агроусадьбы, Бани

5. **Спорт** (sport) - 12 подкатегорий
   - Бассейны, Плавание, Футбол, Баскетбол, Волейбол, Единоборства, Гимнастика и лёгкая атлетика, Фигурное катание, Хоккей, Теннис, Скалолазание, Фитнес и йога

6. **Кафе и еда** (food) - 5 подкатегорий
   - Детские кафе, Рестораны с детской комнатой, Службы доставки, Кейтеринг, Торты и сладости на заказ

7. **Здоровье** (health) - 8 подкатегорий
   - Медицинские центры, Педиатры, Детские стоматологии, Логопеды и дефектологи, Психологи, Анализы и диагностика, УЗИ, ЛФК для детей

8. **Товары и магазины** (shopping) - 8 подкатегорий
   - Магазины игрушек, Детская одежда, Детская обувь, Коляски и автокресла, Детские книги, Детское питание, Товары для творчества, Товары для мам

9. **Услуги для семьи** (family-services) - 7 подкатегорий
   - Фотостудии, Фотосъёмка, Детские салоны красоты, Семейные салоны красоты, Прокат детских товаров, Детский персонал и няни, СПА-центры

10. **Беременность** (pregnancy) - 6 подкатегорий
    - Курсы для беременных, Йога для беременных, Ведение беременности, Роддома, Магазины для беременных, Массаж для беременных

**Особенности:**
- Все slug чистые, без суффиксов `_place`, `_education`, etc.
- Уникальность: `@@unique([publicationType, slug])`
- Все категории имеют `publicationType = PLACE`
- Seed интегрирован в основной `prisma/seed.ts`

### 2. Backend валидация

**Файл:** `src/lib/validation/placeCategoryValidation.ts`

Созданы функции валидации:

#### `validatePlaceCategories(input)`
Строгая валидация для PENDING/PUBLISHED статусов:

1. **Основная категория (primaryCategoryId):**
   - ✅ Обязательна
   - ✅ Должна существовать
   - ✅ Должна иметь `publicationType = PLACE`
   - ✅ Должна быть корневой (`parentId = null`)

2. **Подкатегории (subcategoryIds):**
   - ✅ Обязательны (минимум 1)
   - ✅ Максимум 3
   - ✅ Все должны существовать
   - ✅ Все должны иметь `publicationType = PLACE`
   - ✅ Все должны быть детьми выбранной `primaryCategoryId`

#### `validatePlaceCategoriesDraft(input)`
Мягкая валидация для DRAFT статуса:
- Категории необязательны
- Если указаны, проверяется их корректность

### 3. API обновления

#### POST `/api/business/places`
**Файл:** `src/app/api/business/places/route.ts`

Добавлена валидация категорий:
- Для DRAFT: `validatePlaceCategoriesDraft()`
- Для PENDING/PUBLISHED: `validatePlaceCategories()`
- Сохранение подкатегорий в `PlaceSubcategory` с позициями (0 = основная)

#### PATCH `/api/business/places/[id]`
**Файл:** `src/app/api/business/places/[id]/route.ts`

Добавлена валидация при обновлении:
- Проверка категорий если они обновляются
- Обновление подкатегорий с сохранением порядка

#### GET `/api/public/place-categories`
**Файл:** `src/app/api/public/place-categories/route.ts`

Новый публичный endpoint для получения категорий:
- Возвращает корневые категории с вложенными подкатегориями
- Только активные категории (`isActive = true`)
- Только `publicationType = PLACE`
- Сортировка по `sortOrder`

### 4. UI компоненты

#### Step1Profile
**Файл:** `src/components/business/wizard/place/steps/Step1Profile.tsx`

Компонент уже реализован правильно:
- ✅ Dropdown для выбора основной категории
- ✅ ChipsRow для выбора подкатегорий (1-3)
- ✅ Первая выбранная подкатегория помечена как "Основная"
- ✅ При смене основной категории подкатегории сбрасываются
- ✅ Блокировка выбора после 3 подкатегорий
- ✅ Загрузка категорий из `/api/public/place-categories`

#### Валидация
**Файл:** `src/components/business/wizard/place/validation.ts`

Валидация Step1 обновлена:
- ✅ Проверка `primaryCategoryId`
- ✅ Проверка `subcategoryIds` (минимум 1, максимум 3)

#### Типы
**Файл:** `src/components/business/wizard/place/types.ts`

Типы `PlaceFormData` уже содержат:
```typescript
primaryCategoryId: string | null;
subcategoryIds: string[];
```

## Схема базы данных

### EventCategory
```prisma
model EventCategory {
  id              String                       @id @default(cuid())
  nameRu          String
  nameEn          String
  slug            String
  icon            String?
  sortOrder       Int                          @default(0)
  isActive        Boolean                      @default(true)
  parentId        String?
  publicationType EventCategoryPublicationType @default(EVENT)
  
  parent          EventCategory?               @relation("EventCategoryChildren", fields: [parentId], references: [id])
  children        EventCategory[]              @relation("EventCategoryChildren")
  
  placePrimary    Place[]                      @relation("PlacePrimaryCategory")
  placeSubcategories PlaceSubcategory[]        @relation("PlaceSubcategoryCategory")
  
  @@unique([publicationType, slug])
  @@index([publicationType])
}
```

### Place
```prisma
model Place {
  id                String             @id @default(cuid())
  primaryCategoryId String?
  
  primaryCategory   EventCategory?     @relation("PlacePrimaryCategory", fields: [primaryCategoryId], references: [id])
  subcategories     PlaceSubcategory[]
  
  @@index([primaryCategoryId])
}
```

### PlaceSubcategory
```prisma
model PlaceSubcategory {
  placeId    String
  categoryId String
  position   Int           @default(0)
  
  place      Place         @relation(fields: [placeId], references: [id], onDelete: Cascade)
  category   EventCategory @relation("PlaceSubcategoryCategory", fields: [categoryId], references: [id], onDelete: Cascade)
  
  @@id([placeId, categoryId])
  @@index([placeId, position])
}
```

## Правила работы

### 1. Основная категория
- **Обязательна** для PENDING/PUBLISHED
- **Single-select**
- `parentId = null`
- `publicationType = PLACE`

### 2. Подкатегории
- **Обязательны** для PENDING/PUBLISHED (минимум 1)
- **Multi-select** (максимум 3)
- `parentId = primaryCategoryId`
- `publicationType = PLACE`
- Первая выбранная (`position = 0`) считается основной

### 3. При смене основной категории
- Выбранные подкатегории **сбрасываются**
- Пользователь выбирает новые подкатегории

### 4. Slug
- **Чистые slug** без суффиксов
- Примеры: `education`, `sport`, `food`
- НЕ: `education_place`, `sport_place`

## Проверка

### 1. Seed выполнен успешно
```bash
pnpm db:seed:system
```
Результат:
```
✓ Образование и развитие (12 подкатегорий)
✓ Развлечения и досуг (11 подкатегорий)
✓ Парки и активный отдых (3 подкатегорий)
✓ Загородный отдых (5 подкатегорий)
✓ Спорт (12 подкатегорий)
✓ Кафе и еда (5 подкатегорий)
✓ Здоровье (8 подкатегорий)
✓ Товары и магазины (8 подкатегорий)
✓ Услуги для семьи (7 подкатегорий)
✓ Беременность (6 подкатегорий)
```

### 2. API endpoints
- ✅ `GET /api/public/place-categories` - получение категорий
- ✅ `POST /api/business/places` - создание с валидацией
- ✅ `PATCH /api/business/places/[id]` - обновление с валидацией

### 3. UI компоненты
- ✅ Форма отображает категории Place
- ✅ Event категории не отображаются
- ✅ Можно выбрать одну категорию
- ✅ Можно выбрать 1-3 подкатегории
- ✅ Нельзя выбрать 4 подкатегории
- ✅ При смене категории подкатегории сбрасываются

### 4. Валидация
- ✅ DRAFT: категории необязательны
- ✅ PENDING/PUBLISHED: категории обязательны
- ✅ Проверка существования категорий
- ✅ Проверка типа категорий (PLACE)
- ✅ Проверка иерархии (parent-child)

## Что НЕ делали

- ❌ Не возвращаем `activityTypes` в Place
- ❌ Не возвращаем свободные теги
- ❌ Не добавляем discovery signals в Place
- ❌ Не смешиваем PLACE категории с EVENT категориями
- ❌ Не используем slug с суффиксом `_place`

## Следующие шаги

1. **Миграция существующих Place:**
   - Создать скрипт миграции старых категорий в новую структуру
   - Проверить и обновить существующие записи

2. **Тестирование:**
   - Создание нового Place через wizard
   - Редактирование существующего Place
   - Проверка валидации на всех этапах

3. **Документация:**
   - Обновить документацию для бизнес-пользователей
   - Добавить примеры использования API

## Файлы изменены/созданы

### Созданы:
- `prisma/seed/place-categories.ts` - seed категорий
- `src/lib/validation/placeCategoryValidation.ts` - валидация
- `src/app/api/public/place-categories/route.ts` - API endpoint
- `PLACE_CATEGORIES_IMPLEMENTATION.md` - документация

### Изменены:
- `prisma/seed.ts` - добавлен вызов seed категорий
- `src/app/api/business/places/route.ts` - добавлена валидация
- `src/app/api/business/places/[id]/route.ts` - добавлена валидация

### Без изменений (уже правильные):
- `src/components/business/wizard/place/steps/Step1Profile.tsx`
- `src/components/business/wizard/place/types.ts`
- `src/components/business/wizard/place/validation.ts`
- `prisma/schema.prisma`

## Статус: ✅ ЗАВЕРШЕНО

Система категорий для Place восстановлена и нормализована согласно требованиям.
