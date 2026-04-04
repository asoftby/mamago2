# Place Model Audit - Краткий Summary

## Главный вывод

**Ownership уже реализовано в Place модели.** Нужна только интеграция существующего PlaceClaimRequest в admin UI.

---

## Текущая модель Place

### Основные поля ownership:
- `ownerUserId` (required) - владелец места
- `moderatedByUserId` (optional) - модератор, который проверил
- `archivedByUserId` (optional) - кто архивировал (soft delete)

### Статусы Place (ContentStatus):
```
DRAFT → PENDING → PUBLISHED
  ↓
  NEEDS_REVISION → PENDING → PUBLISHED
  ↓
  REJECTED
```

### Post-publication edits:
- PlaceRevision модель для правок опубликованного места
- Одна active revision (DRAFT/PENDING/NEEDS_REVISION) на Place

---

## Что уже есть для ownership/claim

✅ **PlaceClaimRequest модель** - запросы на владение
- `placeId`, `userId`, `businessId`, `status` (PENDING/APPROVED/REJECTED)
- Связи с Place, User, и reviewer

✅ **API endpoint** - `POST /api/business/places/[id]/claim`
- Создание запроса на владение
- Проверка: пользователь не должен быть владельцем

✅ **Access control** - `canManageOwnedContent(user, ownerUserId)`
- Владелец, админ, модератор могут управлять местом

✅ **Soft delete** - `archivedAt` + `archivedByUserId`
- Место скрывается, но не удаляется

---

## Что НЕ хватает

❌ **Admin endpoints для claim workflow:**
- Нет GET для списка pending claims
- Нет POST для одобрения claim
- Нет POST для отклонения claim

❌ **Admin UI для claims:**
- Нет интерфейса для просмотра claims
- Нет интерфейса для одобрения/отклонения

❌ **Enum для PlaceClaimRequest.status:**
- Сейчас это string, нужен enum

❌ **Notifications:**
- Нет уведомлений при создании claim
- Нет уведомлений при одобрении/отклонении

---

## Текущие статусы Place

| Статус | Значение |
|--------|----------|
| DRAFT | Черновик (не опубликовано) |
| PENDING | На модерации (ожидает проверки) |
| PENDING_UPDATE | Опубликовано, но есть правки на модерации |
| PUBLISHED | Опубликовано (видно пользователям) |
| NEEDS_REVISION | Требуются правки (модератор отправил на доработку) |
| REJECTED | Отклонено (не прошло модерацию) |
| DELETED | Soft-delete (скрыто из списков) |

---

## Текущие связи Place

```
Place
├── ownerUserId → User (владелец)
├── moderatedByUserId → User (модератор)
├── archivedByUserId → User (кто архивировал)
├── cityId → City
├── districtAutoId/districtManualId → District
├── metroAutoId/metroManualId → MetroStation
├── parentPlaceId → Place (для иерархии)
├── placeGroupId → PlaceGroup (для сетей)
├── openingHoursId → OpeningHours
├── images → PlaceImage[]
├── revisions → PlaceRevision[]
├── claimRequests → PlaceClaimRequest[]
└── activities → Activity[]
```

---

## Текущие API endpoints

### Business Cabinet (Owner)
```
POST   /api/business/places              - Create
GET    /api/business/places              - List
GET    /api/business/places/[id]         - Get
PATCH  /api/business/places/[id]         - Update
DELETE /api/business/places/[id]/delete  - Delete
POST   /api/business/places/[id]/archive - Archive
POST   /api/business/places/[id]/claim   - Request ownership ✅
```

### Admin
```
GET    /api/admin/places/[id]                    - Get
DELETE /api/admin/places/[id]                    - Delete
POST   /api/admin/moderation/places/[id]         - Moderate
```

**Нужно добавить:**
```
GET    /api/admin/places/claims                  - List claims
POST   /api/admin/places/claims/[id]/approve     - Approve claim
POST   /api/admin/places/claims/[id]/reject      - Reject claim
```

---

## Текущие сервисы

### moderation.service.ts
- `approvePlace()` - PENDING → PUBLISHED
- `needsRevisionPlace()` - PENDING → NEEDS_REVISION
- `rejectPlace()` - PENDING → REJECTED
- `submitPlace()` - DRAFT → PENDING

### placeRevision.service.ts
- `getOrCreatePlaceRevision()` - создание revision
- `savePlaceRevisionDraft()` - сохранение черновика
- `submitPlaceRevision()` - отправка на модерацию
- `approvePlaceRevision()` - одобрение и merge

### placeLocation.service.ts
- `updatePlaceLocation()` - geo enrichment

---

## Что можно переиспользовать

✅ PlaceClaimRequest модель (уже есть)
✅ ownerUserId поле (уже есть)
✅ Access control pattern (canManageOwnedContent)
✅ Moderation pattern (approvePlace, rejectPlace)
✅ Notification pattern (notifyPlaceApproved, etc.)
✅ ModerationLog для логирования
✅ User relations

---

## Что НЕ нужно дублировать

❌ Не создавать новые enum для ownership (использовать PlaceClaimRequest.status)
❌ Не добавлять новые поля в Place (ownerUserId уже есть)
❌ Не создавать отдельную таблицу для claims (PlaceClaimRequest уже есть)
❌ Не менять ContentStatus enum (он для publication, не для ownership)

---

## Минимальные изменения для claim workflow

1. **Enum для PlaceClaimRequest.status** (вместо string)
2. **Admin endpoints** (3 новых endpoint)
3. **Claim service** (approvePlaceClaim, rejectPlaceClaim)
4. **Admin UI** (список claims, кнопки одобрения/отклонения)
5. **Notifications** (для claim events)

---

## Рекомендация

**Не нужна полная переработка Place модели.**

Текущая архитектура хорошо спроектирована:
- Ownership через ownerUserId ✅
- Moderation lifecycle через ContentStatus ✅
- Post-publication edits через PlaceRevision ✅
- Claim infrastructure через PlaceClaimRequest ✅

Нужна только **интеграция существующего PlaceClaimRequest в admin UI** и добавление необходимых endpoints/notifications.

