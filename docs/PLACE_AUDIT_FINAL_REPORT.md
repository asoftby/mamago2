# Place Model Audit - Final Report

**Дата:** 2026-04-04  
**Статус:** ✅ Завершено  
**Время на аудит:** ~2 часа

---

## Executive Summary

Проведен полный аудит текущей модели Place в mamaGo 2.0 перед добавлением ownership/claim логики.

### Главный вывод

**Ownership уже полностью реализовано в Place модели.** Нужна только интеграция существующего PlaceClaimRequest в admin UI.

### Ключевые находки

✅ **Ownership уже есть:**
- `ownerUserId` поле в Place
- Access control через `canManageOwnedContent()`
- Soft delete через `archivedAt`

✅ **Claim infrastructure уже есть:**
- PlaceClaimRequest модель в schema
- `POST /api/business/places/[id]/claim` endpoint
- Но не интегрировано в admin UI

❌ **Что не хватает:**
- Admin endpoints для одобрения/отклонения claims
- Admin UI для управления claims
- Notifications для claim workflow
- Enum для PlaceClaimRequest.status (вместо string)

---

## Документация

Создано 4 документа:

1. **PLACE_MODEL_AUDIT.md** (14 KB)
   - Полный аудит всех полей, статусов, связей
   - Текущие API endpoints
   - Текущие сервисы и логика
   - Анализ что можно переиспользовать

2. **PLACE_MODEL_AUDIT_SUMMARY.md** (5 KB)
   - Краткий summary для быстрого ознакомления
   - Таблица текущих статусов
   - Список что есть и что не хватает

3. **PLACE_LIFECYCLE_DIAGRAM.md** (12 KB)
   - Визуальные диаграммы lifecycle
   - Data flow diagrams
   - Access control matrix
   - Entity relations diagram

4. **PLACE_OWNERSHIP_NEXT_STEPS.md** (15 KB)
   - Рекомендуемый план реализации (5 phases)
   - Код для каждого phase
   - Timeline (9-14 часов)
   - Risks & mitigation

---

## Текущая архитектура Place

### Основные компоненты

```
Place (основная модель)
├── ownerUserId (required) - владелец
├── status (ContentStatus) - DRAFT/PENDING/PUBLISHED/NEEDS_REVISION/REJECTED/DELETED
├── moderatedByUserId - модератор
├── archivedByUserId - кто архивировал
└── [30+ других полей для данных места]

PlaceRevision (post-publication edits)
├── placeId - ссылка на Place
├── status (PlaceRevisionStatus) - DRAFT/PENDING/NEEDS_REVISION/APPROVED/REJECTED
└── [snapshot всех editable полей Place]

PlaceClaimRequest (ownership requests) ← СУЩЕСТВУЕТ, НО НЕ ИСПОЛЬЗУЕТСЯ
├── placeId - место
├── userId - кто запрашивает
├── status (string) - PENDING/APPROVED/REJECTED ← НУЖЕН ENUM
└── reviewedByUserId - кто рассмотрел
```

### Lifecycle Place

```
DRAFT → PENDING → PUBLISHED
  ↓
  NEEDS_REVISION → PENDING → PUBLISHED
  ↓
  REJECTED
```

### Ownership Transfer Flow

```
User B requests ownership
  ↓
PlaceClaimRequest created (PENDING)
  ↓
Admin reviews
  ↓
├─ APPROVE → Place.ownerUserId = User B
└─ REJECT → Place.ownerUserId remains User A
```

---

## Текущие статусы Place

| Статус | Значение | Используется |
|--------|----------|--------------|
| DRAFT | Черновик | ✅ |
| PENDING | На модерации | ✅ |
| PENDING_UPDATE | Опубликовано, правки на модерации | ✅ |
| PUBLISHED | Опубликовано | ✅ |
| NEEDS_REVISION | Требуются правки | ✅ |
| REJECTED | Отклонено | ✅ |
| DELETED | Soft-delete | ✅ |

---

## Текущие API endpoints

### Business Cabinet (Owner)
- `POST /api/business/places` - Create
- `GET /api/business/places` - List
- `GET /api/business/places/[id]` - Get
- `PATCH /api/business/places/[id]` - Update
- `DELETE /api/business/places/[id]/delete` - Delete
- `POST /api/business/places/[id]/archive` - Archive
- `POST /api/business/places/[id]/claim` - Request ownership ✅

### Admin
- `GET /api/admin/places/[id]` - Get
- `DELETE /api/admin/places/[id]` - Delete
- `POST /api/admin/moderation/places/[id]` - Moderate

**Нужно добавить:**
- `GET /api/admin/places/claims` - List claims
- `POST /api/admin/places/claims/[id]/approve` - Approve
- `POST /api/admin/places/claims/[id]/reject` - Reject

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

### notification.service.ts
- `notifyPlaceApproved()`
- `notifyPlaceNeedsChanges()`
- `notifyPlaceRejected()`
- `notifyPlaceUpdateApproved()`
- `notifyPlaceUpdateNeedsRevision()`
- `notifyPlaceUpdateRejected()`

---

## Что можно переиспользовать

✅ PlaceClaimRequest модель (уже есть)
✅ ownerUserId поле (уже есть)
✅ Access control pattern (`canManageOwnedContent`)
✅ Moderation pattern (`approvePlace`, `rejectPlace`)
✅ Notification pattern (`notifyPlaceApproved`, etc.)
✅ ModerationLog для логирования
✅ User relations

---

## Что НЕ нужно дублировать

❌ Не создавать новые enum для ownership (использовать PlaceClaimRequest.status)
❌ Не добавлять новые поля в Place (ownerUserId уже есть)
❌ Не создавать отдельную таблицу для claims (PlaceClaimRequest уже есть)
❌ Не менять ContentStatus enum (он для publication, не для ownership)

---

## Рекомендуемый план реализации

### Phase 1: Подготовка (1-2h)
- Добавить enum для PlaceClaimRequest.status
- Создать claim service

### Phase 2: Admin API (2-3h)
- `GET /api/admin/places/claims`
- `POST /api/admin/places/claims/[id]/approve`
- `POST /api/admin/places/claims/[id]/reject`

### Phase 3: Notifications (1-2h)
- Добавить notification types
- Добавить notification functions

### Phase 4: Admin UI (3-4h)
- Компонент для списка claims
- Страница в admin panel

### Phase 5: Testing (2-3h)
- Unit tests
- Integration tests

**Total: 9-14 часов**

---

## Выводы

### Текущее состояние

Place модель хорошо спроектирована:
- ✅ Ownership через `ownerUserId`
- ✅ Moderation lifecycle через `ContentStatus`
- ✅ Post-publication edits через `PlaceRevision`
- ✅ Claim infrastructure через `PlaceClaimRequest`

### Что нужно сделать

**Не нужна полная переработка.** Нужна только:
1. Интеграция существующего PlaceClaimRequest в admin UI
2. Добавление enum для status
3. Создание claim service с логикой transfer ownership
4. Добавление notifications

### Риски

- ✅ Минимальные - не ломаем существующую функциональность
- ✅ Backward compatible - PlaceClaimRequest уже в schema
- ✅ Clear scope - только интеграция существующей infrastructure

---

## Рекомендация

**Приступить к реализации Phase 1-2 (Admin API).**

Это даст полную функциональность claim workflow с минимальными изменениями в коде.

---

## Документы для ознакомления

1. `docs/PLACE_MODEL_AUDIT.md` - полный аудит
2. `docs/PLACE_MODEL_AUDIT_SUMMARY.md` - краткий summary
3. `docs/PLACE_LIFECYCLE_DIAGRAM.md` - диаграммы
4. `docs/PLACE_OWNERSHIP_NEXT_STEPS.md` - план реализации

---

## Контрольный список

- [x] Прочитана Prisma schema
- [x] Проанализированы все API endpoints
- [x] Изучены текущие сервисы
- [x] Проверены текущие permissions
- [x] Выявлены существующие ownership-related поля
- [x] Определены недостающие компоненты
- [x] Создан план реализации
- [x] Документация подготовлена

---

## Следующие шаги

1. ✅ Аудит завершен
2. ⏳ Обсудить план с командой
3. ⏳ Начать Phase 1 (Enum + Service)
4. ⏳ Начать Phase 2 (Admin API)
5. ⏳ Начать Phase 3 (Notifications)
6. ⏳ Начать Phase 4 (Admin UI)
7. ⏳ Начать Phase 5 (Testing)

