# Place Ownership Model - Code Reference

## 1. Place Model - Ownership Fields

**Файл:** `prisma/schema.prisma` (lines 1039-1180)

```prisma
model Place {
  id          String        @id @default(cuid())
  ownerUserId String        // ← OWNERSHIP: владелец места
  status      ContentStatus @default(DRAFT)
  
  // Moderation metadata
  moderatedByUserId     String?   // ← Кто проверил
  moderationReviewedAt  DateTime?
  
  // Archive metadata
  archivedAt       DateTime?     // ← Soft delete
  archivedByUserId String?       // ← Кто архивировал
  
  // Relations
  owner          User @relation(fields: [ownerUserId], references: [id], onDelete: Cascade, name: "PlaceOwner")
  moderatedBy    User? @relation(fields: [moderatedByUserId], references: [id], onDelete: SetNull, name: "PlaceModerator")
  archivedBy     User? @relation(fields: [archivedByUserId], references: [id], onDelete: SetNull, name: "PlaceArchiver")
  
  claimRequests  PlaceClaimRequest[]  // ← Claim requests
  
  @@unique([ownerUserId, createRequestId])  // Prevent duplicates
  @@index([ownerUserId])
}
```

**Ownership fields в Place:**
- `ownerUserId` (required) - основное поле ownership
- `moderatedByUserId` (optional) - модератор
- `archivedByUserId` (optional) - кто архивировал

**Нет прямой связи с Business!** Place привязан только к User.

---

## 2. PlaceClaimRequest Model

**Файл:** `prisma/schema.prisma` (lines 1299-1320)

```prisma
model PlaceClaimRequest {
  id               String    @id @default(cuid())
  placeId          String
  userId           String
  businessId       String?   // ← Optional: бизнес запрашивающего
  status           String    @default("PENDING")  // ← String, не enum!
  note             String?
  reviewedAt       DateTime?
  reviewedByUserId String?

  place      Place @relation(fields: [placeId], references: [id], onDelete: Cascade)
  user       User  @relation(fields: [userId], references: [id], onDelete: Cascade, name: "ClaimRequester")
  reviewedBy User? @relation(fields: [reviewedByUserId], references: [id], onDelete: SetNull, name: "ClaimReviewer")

  createdAt DateTime @default(now())

  @@index([placeId, status])
  @@index([userId, createdAt])
  @@index([status])
}
```

**PlaceClaimRequest fields:**
- `id` (CUID)
- `placeId` - место, которое хотят получить
- `userId` - кто запрашивает
- `businessId` (optional) - бизнес запрашивающего (если есть)
- `status` (string) - "PENDING" | "APPROVED" | "REJECTED"
- `note` (optional)
- `reviewedAt` (optional)
- `reviewedByUserId` (optional) - кто рассмотрел

---

## 3. Где используется ownerUserId

**Основные места:**

### 3.1 Access Control
**Файл:** `src/lib/permissions/placeEditPermissions.ts`
```typescript
if (user.id === place.ownerUserId) return true;  // Owner can edit
```

### 3.2 Ownership Check
**Файл:** `src/server/services/place.service.ts`
```typescript
return place?.ownerUserId === userId;
```

### 3.3 API Endpoints (все используют canManageOwnedContent)
**Файл:** `src/app/api/business/places/[id]/route.ts`
```typescript
if (!canManageOwnedContent(user, place.ownerUserId)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Все endpoints, где проверяется ownerUserId:**
- `PATCH /api/business/places/[id]` - Update
- `DELETE /api/business/places/[id]/delete` - Delete
- `POST /api/business/places/[id]/archive` - Archive
- `POST /api/business/places/[id]/revision/*` - Revisions
- `POST /api/business/places/[id]/images/*` - Images
- `POST /api/business/places/[id]/opening-hours/*` - Opening hours
- `POST /api/business/places/[id]/group` - Place groups
- `POST /api/business/places/[id]/improvement-requests` - Improvement requests

### 3.4 Notifications
**Файл:** `src/server/services/moderation.service.ts`
```typescript
notifyPlaceApproved(placeId, place.title, place.ownerUserId)
notifyPlaceNeedsChanges(placeId, place.title, place.ownerUserId, message)
notifyPlaceRejected(placeId, place.title, place.ownerUserId, message)
```

### 3.5 PlaceGroup Creation
**Файл:** `src/app/api/business/places/[id]/group/route.ts`
```typescript
const newGroup = await prisma.placeGroup.create({
  data: {
    ownerUserId: place.ownerUserId,  // ← Group owner = Place owner
    name: groupName,
  },
});
```

---

## 4. POST /api/business/places/[id]/claim - Полный код

**Файл:** `src/app/api/business/places/[id]/claim/route.ts`

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canCreateBusinessContent(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const placeId = params.id;

  // 1. Check if place exists
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, title: true, ownerUserId: true },
  });
  if (!place) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  // 2. Check if user already owns this place
  if (place.ownerUserId === user.id) {
    return NextResponse.json(
      { error: "You already own this place" },
      { status: 400 }
    );
  }

  // 3. Check if there's already a pending request (idempotent)
  const existingRequest = await prisma.placeClaimRequest.findFirst({
    where: {
      placeId,
      userId: user.id,
      status: "PENDING",
    },
  });
  if (existingRequest) {
    return NextResponse.json({
      ok: true,
      requestId: existingRequest.id,
      message: "Request already exists",
    });
  }

  // 4. Get user's business ID (if exists)
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: { id: true },
  });

  // 5. Create claim request
  const claimRequest = await prisma.placeClaimRequest.create({
    data: {
      placeId,
      userId: user.id,
      businessId: business?.id || null,  // ← Optional business link
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ok: true,
    requestId: claimRequest.id,
    message: "Claim request created",
  });
}
```

**Логика:**
1. Проверка прав: `canCreateBusinessContent(user.role)`
2. Проверка: место существует
3. Проверка: пользователь не владелец
4. Проверка: нет pending запроса (идемпотентность)
5. Получение businessId пользователя (если есть)
6. Создание PlaceClaimRequest со статусом "PENDING"

---

## 5. Отсутствующие Admin Endpoints

**Текущие admin endpoints для places:**
- `DELETE /api/admin/places/[id]` - Delete place
- `GET /api/admin/places/[id]/improvement-request` - Get improvement requests
- `POST /api/admin/places/[id]/improvement-request` - Create improvement request
- `PATCH /api/admin/places/[id]/improvement-request` - Resolve improvement request
- `POST /api/admin/places/[id]/approve` - Approve place
- `POST /api/admin/places/[id]/needs-changes` - Request changes
- `POST /api/admin/places/[id]/reject` - Reject place
- `GET /api/admin/places/[id]/display-info` - Get display info
- `GET /api/admin/places/[id]/micro-edit` - Get micro-edits
- `POST /api/admin/places/[id]/micro-edit` - Apply micro-edit

**ОТСУТСТВУЮТ для claim workflow:**
- ❌ `GET /api/admin/places/claims` - List pending claims
- ❌ `POST /api/admin/places/claims/[id]/approve` - Approve claim (transfer ownership)
- ❌ `POST /api/admin/places/claims/[id]/reject` - Reject claim

**Нет endpoint для:**
- Получения списка всех pending claims
- Одобрения claim (transfer ownership)
- Отклонения claim

---

## 6. Привязка Ownership к Business

**Ответ: ТОЛЬКО к User, НЕ к Business**

### Place model:
```prisma
model Place {
  ownerUserId String  // ← User, не Business!
  owner User @relation(...)
}
```

### PlaceClaimRequest model:
```prisma
model PlaceClaimRequest {
  userId String      // ← Кто запрашивает (User)
  businessId String? // ← Optional: бизнес запрашивающего
  user User @relation(...)
}
```

### Логика в claim endpoint:
```typescript
// Get user's business (если есть)
const business = await prisma.business.findUnique({
  where: { ownerUserId: user.id },
  select: { id: true },
});

// Сохранить businessId в claim (опционально)
const claimRequest = await prisma.placeClaimRequest.create({
  data: {
    placeId,
    userId: user.id,
    businessId: business?.id || null,  // ← Optional
    status: "PENDING",
  },
});
```

**Вывод:**
- Place.ownerUserId → User (required)
- PlaceClaimRequest.businessId → Business (optional, только для информации)
- Ownership НЕ привязан к Business
- Один User может иметь одно Business
- Один User может владеть несколькими Places

---

## Summary

| Компонент | Поле | Тип | Обязательно | Примечание |
|-----------|------|-----|------------|-----------|
| Place | ownerUserId | String | ✅ | Основное ownership |
| Place | moderatedByUserId | String? | ❌ | Кто проверил |
| Place | archivedByUserId | String? | ❌ | Кто архивировал |
| PlaceClaimRequest | userId | String | ✅ | Кто запрашивает |
| PlaceClaimRequest | businessId | String? | ❌ | Бизнес запрашивающего |
| PlaceClaimRequest | status | String | ✅ | "PENDING" \| "APPROVED" \| "REJECTED" |
| PlaceClaimRequest | reviewedByUserId | String? | ❌ | Кто рассмотрел |

**Отсутствующие endpoints:**
1. `GET /api/admin/places/claims` - список pending claims
2. `POST /api/admin/places/claims/[id]/approve` - одобрить (transfer ownership)
3. `POST /api/admin/places/claims/[id]/reject` - отклонить

