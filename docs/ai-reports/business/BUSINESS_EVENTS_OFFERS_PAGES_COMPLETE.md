# Business Events & Offers Pages - Complete

## Обзор

Реализованы страницы `/business/events` и `/business/offers` по единому UX/UI паттерну с `/business/places`.

## Ключевые решения

### 1. Терминология
- **UI**: "События" (Events) вместо "Activities" или "Мероприятия"
- **Backend**: продолжаем использовать модель `Activity` без breaking changes
- **Routing**: `/business/events` с редиректом с `/business/activities`
- ✅ **Обновлено**: Все UI тексты используют "События" консистентно

### 2. Архитектурный подход
- Не делали destructive rename Activity → Event
- Сохранили существующую модель данных
- Фокус на консистентном UX, а не на рефакторе доменных имен

## Созданные компоненты

### Shared компоненты (переиспользуемые)

1. **`BusinessContentList<T>`** (`src/components/business/shared/BusinessContentList.tsx`)
   - Generic компонент для списков Places/Events/Offers
   - Единый паттерн для:
     - Табов (Активные/Архив)
     - Empty state
     - Add button
     - Рендера элементов
   - Handlers для delete/archive/unarchive

2. **`ContentStatusBadge`** (`src/components/business/shared/ContentStatusBadge.tsx`)
   - Единообразные badge для ContentStatus
   - Цветовая схема:
     - DRAFT: серый
     - PENDING: желтый
     - PUBLISHED: зеленый
     - NEEDS_REVISION: оранжевый
     - REJECTED: красный

### Events-специфичные компоненты

3. **`EventsList`** (`src/app/business/(protected)/events/EventsList.tsx`)
   - Client component для списка мероприятий
   - Использует `BusinessContentList` с Activity data source

4. **`EventCardHorizontal`** (`src/components/business/events/EventCardHorizontal.tsx`)
   - Карточка мероприятия
   - Паттерн 1:1 с `PlaceCardHorizontal`:
     - Cover image слева
     - Контент справа
     - Status badge
     - Actions (Edit/Archive/Delete)
   - Показывает: место, цену, расписание

### Offers-специфичные компоненты

5. **`OffersList`** (`src/app/business/(protected)/offers/OffersList.tsx`)
   - Client component для списка предложений
   - Использует `BusinessContentList` с Offer data source

6. **`OfferCardHorizontal`** (`src/components/business/offers/OfferCardHorizontal.tsx`)
   - Карточка предложения
   - Тот же паттерн что у Places/Events
   - Показывает: место, даты, цену, тип (EVENT/SERVICE)

7. **`OfferStatusBadge`** (`src/components/business/offers/OfferStatusBadge.tsx`)
   - Badge для OfferStatus (DRAFT/PENDING/PUBLISHED/REJECTED)
   - Та же цветовая схема что у ContentStatus

## Созданные маршруты

### Events
- ✅ `/business/events` - список мероприятий
- ✅ `/business/events/new` - создание (заглушка)
- ✅ `/business/events/[id]/edit` - редактирование (заглушка)
- ✅ `/business/activities` - редирект на `/business/events`

### Offers
- ✅ `/business/offers` - список предложений
- ✅ `/business/offers/new` - создание (заглушка)
- ✅ `/business/offers/[id]/edit` - редактирование (заглушка)

## Единый UX паттерн

### Page Layout
- ✅ Одинаковый container (`max-w-5xl mx-auto p-6`)
- ✅ Одинаковый page header (h1 + subtitle)
- ✅ Одинаковые отступы и ритм

### Tabs/Filters
- ✅ Табы "Активные" / "Архив"
- ✅ Одинаковые стили и поведение
- ✅ URL query param `?view=active|archived`

### Empty State
- ✅ Одинаковая структура:
  - Иконка в круге
  - Заголовок
  - Описание
  - CTA кнопка
- ✅ Разные иконки по контексту:
  - Places: MapPin
  - Events: Calendar
  - Offers: Tag

### Item Cards
- ✅ Горизонтальный layout
- ✅ Image слева (24x24)
- ✅ Контент справа
- ✅ Status badge справа вверху
- ✅ Actions внизу (Edit/Archive/Delete)
- ✅ Одинаковые hover states

### Status System
- ✅ Единая визуальная модель
- ✅ Одинаковые цвета и labels
- ✅ ContentStatus для Events (через Activity)
- ✅ OfferStatus для Offers (адаптирован под ту же схему)

### Actions
- ✅ Edit (иконка карандаша)
- ✅ Archive (иконка архива) - для активных
- ✅ Unarchive (иконка восстановления) - для архивных
- ✅ Delete (иконка корзины) - только для DRAFT

## Что НЕ реализовано (следующие этапы)

### Архивирование
- Activity и Offer не имеют поля `archivedAt`
- Handlers для archive/unarchive созданы, но пока логируют в консоль
- Нужно добавить поля в схему и миграцию

### Create/Edit формы
- Созданы заглушки с информацией
- Полноценные формы - отдельная задача
- Можно переиспользовать паттерн из PlaceWizard

### API endpoints
- Для Events используются существующие `/api/business/activities`
- Для Offers нужны новые endpoints:
  - `POST /api/business/offers`
  - `GET /api/business/offers/[id]`
  - `PATCH /api/business/offers/[id]`
  - `DELETE /api/business/offers/[id]`

### Improvement Requests
- Пока не интегрированы для Events/Offers
- Можно добавить по аналогии с Places

### Revisions
- Пока нет системы ревизий для Events/Offers
- Можно добавить по аналогии с PlaceRevision

## Файлы

### Созданные
```
src/components/business/shared/
  BusinessContentList.tsx          # Generic list component
  ContentStatusBadge.tsx           # Status badge

src/components/business/events/
  EventCardHorizontal.tsx          # Event card

src/components/business/offers/
  OfferCardHorizontal.tsx          # Offer card
  OfferStatusBadge.tsx             # Offer status badge

src/app/business/(protected)/events/
  page.tsx                         # Events list page
  EventsList.tsx                   # Events list client
  new/page.tsx                     # Create event (stub)
  [id]/edit/page.tsx              # Edit event (stub)

src/app/business/(protected)/offers/
  page.tsx                         # Offers list page
  OffersList.tsx                   # Offers list client
  new/page.tsx                     # Create offer (stub)
  [id]/edit/page.tsx              # Edit offer (stub)
```

### Изменённые
```
src/app/business/(protected)/activities/page.tsx  # Redirect to /events
```

## Результат

✅ **Единая система управления контентом**
- Places, Events, Offers выглядят как части одного продукта
- Пользователь чувствует консистентность
- Легко переключаться между разделами

✅ **Переиспользуемые компоненты**
- `BusinessContentList` можно использовать для других типов контента
- `ContentStatusBadge` универсален
- Паттерн карточек легко адаптируется

✅ **Безопасный подход**
- Не ломали существующую архитектуру
- Не делали массовый rename
- Activity остается Activity в backend

✅ **Готово к расширению**
- Легко добавить архивирование
- Легко добавить create/edit формы
- Легко добавить improvement requests

## Следующие шаги

1. **Добавить архивирование**
   - Миграция: добавить `archivedAt` и `archivedByUserId` в Activity и Offer
   - Реализовать API endpoints для archive/unarchive
   - Активировать handlers в EventsList и OffersList

2. **Создать формы**
   - Event create/edit форма (можно адаптировать ActivityForm)
   - Offer create/edit форма
   - Переиспользовать компоненты из PlaceWizard где возможно

3. **API для Offers**
   - CRUD endpoints
   - Validation
   - Moderation flow

4. **Интеграция Improvement Requests**
   - Показывать активные запросы на карточках
   - Добавить фильтр/индикатор

5. **Система ревизий** (опционально)
   - ActivityRevision для post-publication edits
   - OfferRevision для post-publication edits
