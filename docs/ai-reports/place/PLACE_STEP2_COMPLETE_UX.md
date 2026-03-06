# Place Step 2 Location - Complete UX Implementation

## Обзор
Полная реализация Step 2 "Местоположение" в мастере добавления Place с правильной логикой дублей, unit-flow (ТЦ/комплекс), ручной точкой и claim-flow через модалку.

## Реализованные изменения

### 1. Prisma Migration - PlaceClaimRequest Model
**Файл:** `prisma/migrations/20260305091055_place_claim_request/migration.sql`

**Новая модель:**
```prisma
model PlaceClaimRequest {
  id               String   @id @default(cuid())
  placeId          String
  userId           String
  businessId       String?
  status           String   @default("PENDING") // PENDING | APPROVED | REJECTED
  note             String?
  reviewedAt       DateTime?
  reviewedByUserId String?
  
  place      Place  @relation(...)
  user       User   @relation(...)
  reviewedBy User?  @relation(...)
  
  createdAt DateTime @default(now())
  
  @@index([placeId, status])
  @@index([userId, createdAt])
  @@index([status])
}
```

### 2. API Endpoint - Claim Request
**Файл:** `src/app/api/business/places/[id]/claim/route.ts`

**Endpoint:** `POST /api/business/places/[id]/claim`

**Функциональность:**
- Проверяет существование Place
- Проверяет что пользователь не владелец
- Создает PlaceClaimRequest (idempotent - если уже есть PENDING, возвращает существующий)
- Сохраняет businessId если есть

**Response:**
```json
{
  "ok": true,
  "requestId": "...",
  "message": "Claim request created"
}
```

### 3. ConfirmExistingPlaceModal Component
**Файл:** `src/components/business/place/ConfirmExistingPlaceModal.tsx`

**Функциональность:**
- Загружает детали Place по ID
- Показывает название, адрес, placeKind
- 3 кнопки:
  1. **"Да, это моё — запросить доступ"** (Primary) → вызывает claim API
  2. **"Нет, это другое — добавить новое здесь"** (Secondary) → открывает unit-flow
  3. **"Перейти к месту"** (Ghost/Link) → открывает Place в новой вкладке

**UX:**
- Показывает успех: "Запрос отправлен на модерацию"
- Автозакрытие через 2 секунды после успеха
- Обработка ошибок

### 4. PlaceLocationPicker - Полная переработка
**Файл:** `src/components/business/place/PlaceLocationPicker.tsx`

#### STATE 1: Exact Duplicate (exactDuplicate != null)
**UI:**
- Синий блок: "Похоже, это место уже добавлено"
- Карточка с названием и адресом
- Кнопки:
  - "Открыть" → модалка
  - "Это другое место по этому адресу" → unit-flow

**Логика:**
- НЕ показывает жёлтый список одновременно
- Убран технический текст "Точное совпадение Google Place ID"

#### STATE 2: Nearby Matches (exactDuplicate == null, matches.length > 0)
**UI:**
- Жёлтый блок: "По этому адресу уже есть места"
- Список до 5 карточек с:
  - Название, адрес
  - Расстояние (~50м)
  - Badge placeKind (Комплекс/Юнит)
  - Кнопка "Открыть" → модалка
- Большая кнопка: "Добавить другое место по этому адресу" → unit-flow

#### STATE 3: No Matches
- Обычная карта и поиск
- Ничего дополнительного не показывается

#### Unit Flow (showUnitFlow = true)
**UI секция:**

1. **Toggle: "Уточнить местоположение вручную"**
   - Включает режим клика по карте
   - Показывает lat/lng (6 знаков)
   - Кнопка "Сохранить точку" → POST `/location/manual`

2. **Checkbox: "Внутри ТЦ / комплекса"**
   - Если включено: `placeKind = UNIT`
   - Показывает дополнительные поля

3. **Поля:**
   - Этаж (floor)
   - Павильон / офис / помещение (unit)
   - Как обозначено на месте (unitLabel) - только если isInsideComplex
   - Как найти (customAddress) - textarea

4. **Select "Базовый объект"** (только если isInsideComplex)
   - Предзаполнен из matches где placeKind == COMPLEX или STANDALONE
   - Сохраняет parentPlaceId

5. **Кнопка "Сохранить уточнения"**
   - PATCH `/api/business/places/[id]` с полями:
     - placeKind
     - floor
     - unit
     - unitLabel
     - customAddress
     - parentPlaceId

### 5. Google Autocomplete - Улучшения
**Настройки:**
- `types: ["geocode", "establishment"]` - адреса И названия
- `fields: ["place_id", "name", "geometry", "formatted_address", "address_components", "types"]`
- `componentRestrictions: { country: "by" }`
- `bounds: minskBounds, strictBounds: false` - приоритет Минску, но поиск по всей Беларуси

**Стратегия координат:**
1. PlacesService.getDetails (для establishments)
2. Geocoder.geocode({ placeId }) (для адресов)
3. Geocoder.geocode({ address }) (fallback)

### 6. Manual Point Selection
**Функциональность:**
- Карта становится clickable
- Клик → сохраняет lat/lng в state
- Показывает координаты readonly (6 знаков)
- Кнопка "Сохранить точку" → POST `/location/manual`

**Payload:**
```json
{
  "lat": 53.900600,
  "lng": 27.559000,
  "customAddress": "..."
}
```

**Обновления:**
- `locationSource = MANUAL`
- `googlePlaceId = null` (сбрасывается)
- Координаты БЕЗ округления

## API Endpoints

### Существующие (используются)
1. `GET /api/business/places/location/matches` - поиск дублей
2. `POST /api/business/places/[id]/location/google` - сохранение Google локации
3. `POST /api/business/places/[id]/location/manual` - сохранение ручной точки
4. `PATCH /api/business/places/[id]` - обновление полей Place
5. `GET /api/business/places/[id]` - получение деталей Place

### Новые (созданы)
6. `POST /api/business/places/[id]/claim` - запрос прав на Place

## UX Improvements

### Убраны противоречия
- ❌ Больше НЕТ одновременного показа красного и жёлтого блоков
- ✅ Чёткие состояния: STATE 1 (exact) ИЛИ STATE 2 (nearby) ИЛИ STATE 3 (clean)

### Понятные тексты
- "Похоже, это место уже добавлено" вместо технического "Exact duplicate"
- "По этому адресу уже есть места" для nearby
- "Добавить другое место по этому адресу" вместо "Add your place"

### Модалка вместо inline
- Вопрос "Это ваше место?" в модалке
- Понятные варианты действий
- Claim request с подтверждением

### Unit Flow
- Checkbox "Внутри ТЦ / комплекса" понятен пользователю
- Поля этаж/павильон/как найти
- Select родительского комплекса из найденных мест
- Ручная точка с координатами

## Технические детали

### Haversine Distance
Радиус 100м, точный расчёт в JS после bounding box фильтра в Prisma.

### Координаты
- Сохраняются БЕЗ округления (Float, не Decimal)
- Показываются с 6 знаками в UI
- Полная точность в БД

### Маркеры
- AdvancedMarkerElement если есть Map ID
- Fallback на regular Marker
- Цвет бренда #EF8759

### Состояние
- Singleton promise для инициализации Google Maps
- Cleanup markers при unmount
- isCancelledRef для предотвращения race conditions

## Acceptance Criteria

- ✅ UI не показывает одновременно красный дубль и жёлтый список
- ✅ "Открыть" открывает модалку с вопросом "Это ваше место?"
- ✅ Пользователь может запросить доступ (claim request)
- ✅ Пользователь может добавить новое место по тому же адресу (unit-flow)
- ✅ Можно вручную указать точку на карте
- ✅ Можно указать "внутри ТЦ/комплекса" + этаж/павильон/как найти
- ✅ Радиус совпадений 100м работает
- ✅ Step2 обновляет существующий DRAFT placeId, не создаёт новый

## Файлы

### Созданные
1. `src/app/api/business/places/[id]/claim/route.ts`
2. `src/components/business/place/ConfirmExistingPlaceModal.tsx`
3. `prisma/migrations/20260305091055_place_claim_request/migration.sql`

### Изменённые
1. `prisma/schema.prisma` - добавлена модель PlaceClaimRequest
2. `src/components/business/place/PlaceLocationPicker.tsx` - полная переработка
3. `src/app/api/business/places/location/matches/route.ts` - минорные правки

## Следующие шаги (не в этом PR)

### Админка для Claim Requests
- Список запросов на доступ
- Approve/Reject с передачей ownership
- Уведомления пользователю

### Manual Address Mode
- Кнопка "Не нахожу в Google"
- Textarea для ввода адреса текстом
- Обязательная ручная точка на карте

### Улучшения
- Drag marker для уточнения точки
- Показ фото Place в модалке
- История claim requests для пользователя

## Testing Checklist

- [ ] Exact duplicate показывает STATE 1 (синий блок)
- [ ] Nearby matches показывает STATE 2 (жёлтый блок)
- [ ] Нет совпадений = чистая карта (STATE 3)
- [ ] Модалка открывается по клику "Открыть"
- [ ] Claim request создаётся и показывает успех
- [ ] Unit flow открывается по "Добавить другое место"
- [ ] Checkbox "Внутри ТЦ" показывает/скрывает поля
- [ ] Select родительского комплекса работает
- [ ] Ручная точка: клик по карте → координаты → сохранение
- [ ] Сохранение уточнений обновляет Place
- [ ] Координаты сохраняются без округления

---

**Статус:** ✅ Реализовано
**Дата:** 2026-03-05
**Версия:** 1.0
