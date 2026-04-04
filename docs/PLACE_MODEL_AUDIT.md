# Аудит текущей модели Place в mamaGo 2.0

## Дата: 2026-04-04

## Цель
Анализ существующей реализации модели Place перед добавлением ownership/claim логики. Выявление текущих полей, статусов, связей и lifecycle для избежания дублирования и ломки архитектуры.

---

## 1. ТЕКУЩАЯ МОДЕЛЬ PLACE

### 1.1 Основные поля

**Идентификация:**
- `id` (CUID) - уникальный идентификатор
- `createRequestId` (string, optional) - для идемпотентности при создании
- `slug` (string, unique, optional) - SEO-friendly URL

**Ownership:**
- `ownerUserId` (string, required) - владелец места (User.id)
  - Связь: `owner User @relation("PlaceOwner")`
  - Каскадное удаление при удалении пользователя

**Статус и модерация:**
- `status` (ContentStatus enum) - текущий статус (см. ниже)
- `moderatedByUserId` (string, optional) - модератор/админ, который проверил
- `moderatorComment` (string, optional) - комментарий модератора
- `moderationReviewedAt` (DateTime, optional) - когда была проверка
- `revisionRequestedAt` (DateTime, optional) - когда был запрос на правки
- `revisionResubmittedAt` (DateTime, optional) - когда были переданы правки

**Архивирование (soft delete):**
- `archivedAt` (DateTime, optional) - когда было архивировано
- `archivedByUserId` (string, optional) - кто архивировал
  - Связь: `archivedBy User @relation("PlaceArchiver")`

**Основная информация:**
- `title` (string, required) - название места
- `category` (string, required) - категория (e.g., "cafe", "museum", "park")
- `shortDesc` (string, required) - краткое описание для карточек
- `shortAddress` (string, optional) - короткий адрес для дизамбигуации
- `description` (string, optional) - полное описание

**Изображения:**
- `logoImageId` (string, optional) - ID логотипа (PlaceImage.id)
- Связь: `images PlaceImage[]` - все изображения места

**Локация:**
- `lat` (Float, optional) - широта
- `lng` (Float, optional) - долгота
- `googlePlaceId` (string, optional) - ID из Google Places
- `formattedAddr` (string, optional) - отформатированный адрес
- `addressJson` (Json, optional) - полные компоненты адреса от Google
- `customAddress` (string, optional) - ручной адрес (если MANUAL source)
- `locationSource` (LocationSource enum) - GOOGLE или MANUAL
- `countryCode` (string, optional) - код страны

**Геообогащение:**
- `cityId` (string, optional) - город (City.id)
- `districtAutoId` (string, optional) - автоопределенный район
- `districtManualId` (string, optional) - выбранный вручную район (override)
- `metroAutoId` (string, optional) - автоопределенная станция метро
- `metroAutoDistanceM` (int, optional) - расстояние до метро в метрах
- `metroManualId` (string, optional) - выбранная вручную станция (override)
- `metroManualDistanceM` (int, optional) - расстояние до выбранного метро

**Иерархия (Complex → Units):**
- `placeKind` (PlaceKind enum) - STANDALONE, COMPLEX, или UNIT
- `parentPlaceId` (string, optional) - родительское место (для UNIT)
- `unitLabel` (string, optional) - название юнита (e.g., "2 этаж, павильон A12")
- `floor` (string, optional) - этаж
- `unit` (string, optional) - номер юнита

**Контакты:**
- `phone` (string, optional) - телефон
- `website` (string, optional) - веб-сайт
- `instagramHandle` (string, optional) - инстаграм хэндл
- `instagramUrl` (string, optional) - URL инстаграма

**Теги и атрибуты:**
- `ageTags` (string[], default []) - возрастные группы (e.g., ["0-3", "3-7", "7-12"])
- `visitFormats` (string[], default []) - форматы посещения (e.g., ["indoor", "outdoor"])
- `activityTypes` (string[], default []) - типы активностей (e.g., ["sports", "arts"])

**Группировка мест:**
- `placeGroupId` (string, optional) - группа мест (для сетей/цепочек)
  - Связь: `placeGroup PlaceGroup?`

**Режим работы:**
- `openingHoursId` (string, optional) - ID режима работы (OpeningHours.id)
  - Связь: `openingHours OpeningHours?`

**Улучшения:**
- `hasActiveImprovementRequests` (boolean, default false) - есть ли активные запросы на улучшение

**SEO:**
- `seoTitle`, `seoDescription`, `seoH1`, `seoCanonicalUrl`, `seoCanonicalSource`, `seoOgTitle`, `seoOgDescription`, `seoOgImage`, `seoRobots`, `seoJsonLdOverride`
- `slugUpdatedAt` (DateTime, optional) - когда был изменен slug

**Временные метки:**
- `createdAt` (DateTime, default now)
- `updatedAt` (DateTime, auto-update)

---

## 2. СТАТУСЫ PLACE (ContentStatus enum)

```
enum ContentStatus {
  DRAFT              // Черновик (не опубликовано)
  PENDING            // На модерации (ожидает проверки)
  PENDING_UPDATE     // Опубликовано, но есть правки на модерации
  PUBLISHED          // Опубликовано (видно пользователям)
  NEEDS_REVISION     // Требуются правки (модератор отправил на доработку)
  REJECTED           // Отклонено (не прошло модерацию)
  DELETED            // Soft-delete (скрыто из списков, запись сохранена)
}
```

### Lifecycle Place:

```
DRAFT → PENDING → PUBLISHED
  ↓
  NEEDS_REVISION → PENDING → PUBLISHED
  ↓
  REJECTED
```

**Для post-publication edits используется PlaceRevision:**
```
PUBLISHED (Place) + PlaceRevision (DRAFT/PENDING/NEEDS_REVISION)
```

---

## 3. СВЯЗАННЫЕ МОДЕЛИ

### 3.1 PlaceRevision (post-publication edits)

**Назначение:** Хранит pending изменения для опубликованного Place

**Поля:**
- `id` (CUID)
- `placeId` (string, required) - ссылка на Place
- `status` (PlaceRevisionStatus enum) - DRAFT, PENDING, NEEDS_REVISION, APPROVED, REJECTED
- `improvementRequestId` (string, optional) - связь с запросом на улучшение
- Все те же поля, что и Place (title, category, shortDesc, etc.) - snapshot
- `moderatorComment`, `submittedAt`, `reviewedAt`, `reviewedByUserId`
- `revisionRequestedAt`, `revisionResubmittedAt`
- Связь: `place Place`, `reviewedBy User?`, `city City?`

**Правило:** Только одна активная revision (DRAFT/PENDING/NEEDS_REVISION) на Place

### 3.2 PlaceClaimRequest (ownership requests)

**Назначение:** Запрос на владение существующим местом

**Поля:**
- `id` (CUID)
- `placeId` (string, required) - место, которое хотят получить
- `userId` (string, required) - кто запрашивает
- `businessId` (string, optional) - бизнес запрашивающего (если есть)
- `status` (string, default "PENDING") - PENDING, APPROVED, REJECTED
- `note` (string, optional) - примечание
- `reviewedAt` (DateTime, optional) - когда был рассмотрен
- `reviewedByUserId` (string, optional) - кто рассмотрел
- Связи: `place Place`, `user User`, `reviewedBy User?`

**Текущее состояние:** Модель существует, но не используется в UI/API

### 3.3 PlaceImage (изображения)

**Поля:**
- `id` (CUID)
- `placeId` (string, required)
- `kind` (PlaceImageKind enum) - LOGO или GALLERY
- `url`, `width`, `height`, `blurhash`, `sortOrder`

### 3.4 PlaceSlugHistory (SEO redirects)

**Назначение:** Хранит старые slugs для редиректов

**Поля:**
- `id` (CUID)
- `placeId` (string, required)
- `slug` (string, unique) - старый slug

### 3.5 PlaceGroup (сети/цепочки мест)

**Назначение:** Группирует места, принадлежащие одной сети

**Поля:**
- `id` (CUID)
- `ownerUserId` (string, required) - владелец группы
- `name` (string, optional) - название группы (e.g., "Пуговка")
- Связь: `places Place[]`

---

## 4. ТЕКУЩИЕ OWNERSHIP-RELATED ПОЛЯ

### Что уже есть:

✅ **ownerUserId** - основное поле ownership
- Один владелец на Place
- Каскадное удаление при удалении пользователя
- Используется для access control

✅ **moderatedByUserId** - кто проверил
- Админ/модератор, который одобрил/отклонил
- Отдельно от владельца

✅ **archivedByUserId** - кто архивировал
- Владелец или админ, который архивировал место
- Soft-delete через `archivedAt`

✅ **PlaceClaimRequest** - запросы на владение
- Модель существует в schema
- Но не используется в текущем UI/API

✅ **PlaceGroup** - группировка мест
- Для сетей/цепочек
- Один владелец на группу

### Чего НЕТ:

❌ **Co-ownership / shared access** - нет поддержки нескольких владельцев
❌ **Roles/permissions** - нет ролей для места (только глобальные роли User)
❌ **Managers/editors** - нет отдельных редакторов места
❌ **Claim workflow** - PlaceClaimRequest существует, но не интегрирован
❌ **Transfer ownership** - нет механизма передачи владения
❌ **Audit trail** - нет полного логирования изменений ownership

---

## 5. ТЕКУЩИЙ LIFECYCLE PLACE

### 5.1 Создание (Business Cabinet)

**API:** `POST /api/business/places`

**Параметры:**
- `createRequestId` (string) - для идемпотентности
- `status` (string) - DRAFT или PENDING (или PUBLISHED для админов)
- `data` (object) - данные места

**Логика:**
1. Проверка прав: `canCreateBusinessContent(user.role)`
2. Идемпотентность: проверка `(ownerUserId, createRequestId)` unique
3. Создание Place со статусом DRAFT или PENDING
4. Geo enrichment (если есть координаты)
5. Attachment temp media (если wizardSessionId)
6. Slug generation (если PUBLISHED)

**Результат:** Place в статусе DRAFT или PENDING

### 5.2 Модерация (Admin)

**API:** `POST /api/admin/moderation/places/[id]`

**Действия:**
- `APPROVE` - PENDING → PUBLISHED (+ slug assignment)
- `NEEDS_REVISION` - PENDING → NEEDS_REVISION (+ notification)
- `REJECT` - PENDING → REJECTED (+ notification)

**Логика:**
- Проверка прав: `user.role === "ADMIN" || "MODERATOR"`
- Обязательный комментарий для NEEDS_REVISION и REJECT
- Логирование в ModerationLog
- Отправка уведомлений владельцу

### 5.3 Post-Publication Edits (PlaceRevision)

**API:** `POST /api/business/places/[id]/revisions`

**Логика:**
1. Проверка: Place должен быть PUBLISHED
2. Получение или создание active revision (DRAFT)
3. Snapshot текущих данных Place
4. Редактирование revision
5. Submit revision → PENDING
6. Модератор проверяет → APPROVED (merge в Place) или NEEDS_REVISION

**Результат:** Place остается PUBLISHED, но с pending изменениями в PlaceRevision

### 5.4 Архивирование (Soft Delete)

**API:** `POST /api/business/places/[id]/archive`

**Логика:**
- Установка `archivedAt` и `archivedByUserId`
- Place остается в БД, но скрыто из списков
- Может быть восстановлено

---

## 6. ТЕКУЩИЕ API ENDPOINTS

### Business Cabinet (Owner)

```
POST   /api/business/places              - Create place
GET    /api/business/places              - List my places
GET    /api/business/places/[id]         - Get place details
PATCH  /api/business/places/[id]         - Update place
DELETE /api/business/places/[id]/delete  - Delete place
POST   /api/business/places/[id]/archive - Archive place
DELETE /api/business/places/[id]/archive - Unarchive place
POST   /api/business/places/[id]/claim   - Request ownership (claim)
POST   /api/business/places/[id]/revisions - Create/edit revision
```

### Admin

```
GET    /api/admin/places/[id]                    - Get place (admin view)
DELETE /api/admin/places/[id]                    - Delete place (hard delete)
POST   /api/admin/moderation/places/[id]         - Moderate place
POST   /api/admin/moderation/places/[id]/approve - Approve
POST   /api/admin/moderation/places/[id]/needs-changes - Request changes
POST   /api/admin/moderation/places/[id]/reject  - Reject
```

---

## 7. ТЕКУЩИЕ PERMISSIONS

### Access Control (businessContentAccess.ts)

**canCreateBusinessContent(role):**
- BUSINESS_OWNER, ADMIN, MODERATOR

**canManageOwnedContent(user, ownerUserId):**
- `user.id === ownerUserId` (владелец)
- `user.role === "ADMIN"` (админ)
- `user.role === "MODERATOR"` (модератор)

**canPublishContentDirectly(role):**
- ADMIN, MODERATOR

---

## 8. ТЕКУЩИЕ ENUMS И ТИПЫ

### PlaceKind
```
STANDALONE  // Обычное отдельное место
COMPLEX     // Торговый центр / парк / большой объект
UNIT        // Точка внутри комплекса (павильон, островок)
```

### LocationSource
```
GOOGLE      // Из Google Places
MANUAL      // Ручной ввод
```

### PlaceImageKind
```
LOGO        // Логотип
GALLERY     // Галерея
```

### PlaceRevisionStatus
```
DRAFT
PENDING
NEEDS_REVISION
APPROVED
REJECTED
```

---

## 9. ТЕКУЩИЕ СВЯЗИ PLACE

```
Place ← User (ownerUserId)
Place ← User (moderatedByUserId)
Place ← User (archivedByUserId)
Place ← City (cityId)
Place ← District (districtAutoId, districtManualId)
Place ← MetroStation (metroAutoId, metroManualId)
Place ← Place (parentPlaceId) - hierarchy
Place ← PlaceGroup (placeGroupId)
Place ← OpeningHours (openingHoursId)
Place → PlaceImage[]
Place → PlaceRevision[]
Place → PlaceSlugHistory[]
Place → PlaceClaimRequest[]
Place → Activity[] (activities using this place)
Place → Offer[]
Place → EventVenue[]
Place → RouteStop[]
```

---

## 10. ТЕКУЩИЕ СЕРВИСЫ И ЛОГИКА

### placeLocation.service.ts
- `updatePlaceLocation()` - geo enrichment (district, metro)

### placeRevision.service.ts
- `getOrCreatePlaceRevision()` - создание/получение active revision
- `savePlaceRevisionDraft()` - сохранение черновика revision
- `submitPlaceRevision()` - отправка на модерацию
- `approvePlaceRevision()` - одобрение и merge в Place
- `needsRevisionPlaceRevision()` - запрос на правки
- `rejectPlaceRevision()` - отклонение

### moderation.service.ts
- `approvePlace()` - PENDING → PUBLISHED
- `needsRevisionPlace()` - PENDING → NEEDS_REVISION
- `rejectPlace()` - PENDING → REJECTED
- `submitPlace()` - DRAFT/NEEDS_REVISION/REJECTED → PENDING

### notification.service.ts
- `notifyPlaceApproved()`
- `notifyPlaceNeedsChanges()`
- `notifyPlaceRejected()`
- `notifyPlaceUpdateApproved()`
- `notifyPlaceUpdateNeedsRevision()`
- `notifyPlaceUpdateRejected()`

---

## 11. АНАЛИЗ: ЧТО МОЖНО ПЕРЕИСПОЛЬЗОВАТЬ

### ✅ Для Ownership/Claim логики:

1. **PlaceClaimRequest модель** - уже существует, нужно только интегрировать в UI/API
2. **ownerUserId** - основное поле ownership, уже используется
3. **Access control pattern** - `canManageOwnedContent()` можно расширить
4. **Moderation pattern** - для одобрения claim requests
5. **Notification pattern** - для уведомлений о claim requests
6. **ModerationLog** - для логирования claim actions
7. **User relations** - уже есть связи User ← Place

### ❌ Что НЕ нужно дублировать:

- Не создавать новые enum для ownership status (использовать PlaceClaimRequest.status)
- Не добавлять новые поля в Place для ownership (ownerUserId уже есть)
- Не создавать отдельную таблицу для claim requests (PlaceClaimRequest уже есть)
- Не менять ContentStatus enum (он для publication lifecycle, не для ownership)

---

## 12. ЧТО ДЕЙСТВИТЕЛЬНО НУЖНО ДОБАВИТЬ

### Минимальные изменения:

1. **PlaceClaimRequest enum для status** (вместо string)
   ```
   enum PlaceClaimRequestStatus {
     PENDING
     APPROVED
     REJECTED
   }
   ```

2. **API endpoints для claim workflow:**
   - `POST /api/business/places/[id]/claim` - создать запрос (уже есть!)
   - `GET /api/admin/places/claims` - список запросов (нужно)
   - `POST /api/admin/places/claims/[id]/approve` - одобрить (нужно)
   - `POST /api/admin/places/claims/[id]/reject` - отклонить (нужно)

3. **Claim service:**
   - `approvePlaceClaim()` - transfer ownership
   - `rejectPlaceClaim()` - отклонить запрос
   - `getPendingClaims()` - получить pending requests

4. **UI для claim workflow:**
   - Admin panel для просмотра и одобрения claims
   - Notifications для владельца и запрашивающего

5. **Permissions:**
   - Только ADMIN может одобрять claims
   - Владелец может видеть claims на свое место

---

## 13. ВЫВОДЫ

### Текущее состояние:

✅ **Ownership уже реализовано:**
- `ownerUserId` - основное поле
- Access control через `canManageOwnedContent()`
- Soft delete через `archivedAt`

✅ **Claim infrastructure уже есть:**
- `PlaceClaimRequest` модель
- `POST /api/business/places/[id]/claim` endpoint
- Но не интегрировано в admin UI

❌ **Что не хватает:**
- Admin endpoints для одобрения/отклонения claims
- Admin UI для управления claims
- Notifications для claim workflow
- Enum для PlaceClaimRequest.status (вместо string)

### Рекомендация:

**Не нужна полная переработка модели Place.** Нужна только:
1. Интеграция существующего PlaceClaimRequest в admin UI
2. Добавление enum для status
3. Создание claim service с логикой transfer ownership
4. Добавление notifications

**Это минимальные изменения, которые не ломают текущую архитектуру.**

---

## 14. NEXT STEPS

1. ✅ Аудит завершен
2. ⏳ Дизайн claim workflow (как выглядит в admin UI)
3. ⏳ Реализация claim service
4. ⏳ Добавление admin endpoints
5. ⏳ Добавление admin UI
6. ⏳ Тестирование

