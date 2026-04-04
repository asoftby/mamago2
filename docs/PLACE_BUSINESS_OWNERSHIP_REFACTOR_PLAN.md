# Place Business Ownership Refactor - План

## Контекст

**Текущая модель:**
- Place.ownerUserId → User (misleading: это creator, не owner)
- Business.ownerUserId → User (one-to-one, MVP)
- Нет membership/roles модели
- Access через `canManageOwnedContent(user, ownerUserId)`

**Целевая модель:**
- Place.createdByUserId → User (кто создал)
- Place.ownerBusinessId → Business (кто владеет)
- Access через Business ownership
- База пустая - можно делать clean refactor

---

## Текущая Business Access Model

### Business Model (MVP)
```prisma
model Business {
  id          String @id
  ownerUserId String @unique  // One business per owner (MVP)
  owner       User @relation(...)
}
```

**Важно:** Нет membership/roles. Business = один владелец User.

### Access Control
```typescript
// src/lib/auth/businessContentAccess.ts

canCreateBusinessContent(role: Role): boolean
  // BUSINESS_OWNER, ADMIN, MODERATOR

canManageOwnedContent(user, ownerUserId): boolean
  // user.id === ownerUserId || ADMIN || MODERATOR

canPublishContentDirectly(role): boolean
  // ADMIN || MODERATOR
```

---

## Целевая архитектура

### 1. Place Model

```prisma
model Place {
  id               String @id
  createdByUserId  String        // Кто создал (audit trail)
  ownerBusinessId  String?       // Какой бизнес владеет (nullable)
  status           ContentStatus
  
  // Moderation
  moderatedByUserId String?
  archivedByUserId  String?
  
  // Relations
  createdBy     User      @relation("PlaceCreator")
  ownerBusiness Business? @relation("BusinessPlaces")
  moderatedBy   User?     @relation("PlaceModerator")
  archivedBy    User?     @relation("PlaceArchiver")
  
  @@index([createdByUserId])
  @@index([ownerBusinessId])
}
```

### 2. PlaceClaimRequest Model

```prisma
enum PlaceClaimRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELED
}

model PlaceClaimRequest {
  id               String                   @id
  placeId          String
  userId           String                   // Кто запрашивает
  businessId       String                   // Целевой business (required!)
  status           PlaceClaimRequestStatus  @default(PENDING)
  note             String?
  reviewedAt       DateTime?
  reviewedByUserId String?
  
  place      Place    @relation(...)
  user       User     @relation("ClaimRequester")
  business   Business @relation("ClaimedPlaces")
  reviewedBy User?    @relation("ClaimReviewer")
  
  @@index([placeId, status])
  @@index([businessId, status])
}
```

### 3. Business Model (добавить relation)

```prisma
model Business {
  id          String @id
  ownerUserId String @unique
  
  owner User @relation(...)
  
  // NEW: Places owned by this business
  places Place[] @relation("BusinessPlaces")
  claimRequests PlaceClaimRequest[] @relation("ClaimedPlaces")
}
```

---

## Access Control - Новая логика

### Helper: canManagePlace

```typescript
// src/lib/auth/placeAccess.ts

export function canManagePlace(
  user: { id: string; role: Role },
  place: { createdByUserId: string; ownerBusinessId: string | null }
): boolean {
  // Admin/Moderator - full access
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return true;
  }
  
  // If place has business owner
  if (place.ownerBusinessId) {
    // Check if user owns this business
    return canAccessBusiness(user.id, place.ownerBusinessId);
  }
  
  // If place has no business owner (unowned)
  // Only creator can manage (or admin/moderator)
  return user.id === place.createdByUserId;
}

export async function canAccessBusiness(
  userId: string,
  businessId: string
): Promise<boolean> {
  // MVP: Business.ownerUserId === userId
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerUserId: true },
  });
  
  return business?.ownerUserId === userId;
}
```

---

## Миграция - Шаги

### Phase 1: Schema Update

1. **Rename ownerUserId → createdByUserId**
   - Prisma schema
   - Relation name: PlaceOwner → PlaceCreator
   - Index update

2. **Add ownerBusinessId**
   - Nullable field
   - Relation to Business
   - Index

3. **Update PlaceClaimRequest**
   - Add enum PlaceClaimRequestStatus
   - Make businessId required
   - Add relation to Business

4. **Update Business**
   - Add places relation
   - Add claimRequests relation

5. **Migration**
   ```bash
   npx prisma migrate dev --name place_business_ownership_refactor
   ```

### Phase 2: Access Control

1. **Create placeAccess.ts**
   - canManagePlace()
   - canAccessBusiness()

2. **Update businessContentAccess.ts**
   - Deprecate canManageOwnedContent for Places
   - Keep for other entities (Activity, Offer)

### Phase 3: API Endpoints

1. **Update CREATE Place**
   - Set createdByUserId = user.id
   - Set ownerBusinessId = user.business.id (if exists)

2. **Update all business endpoints**
   - Replace canManageOwnedContent → canManagePlace
   - Update queries to include ownerBusinessId

3. **Add admin claim endpoints**
   - GET /api/admin/places/claims
   - POST /api/admin/places/claims/[id]/approve
   - POST /api/admin/places/claims/[id]/reject

4. **Add admin assign owner**
   - POST /api/admin/places/[id]/assign-owner

### Phase 4: Services

1. **Update moderation.service.ts**
   - Use createdByUserId for notifications
   - Update ownership checks

2. **Update placeRevision.service.ts**
   - Use canManagePlace

3. **Create placeClaim.service.ts**
   - approvePlaceClaim() - set ownerBusinessId
   - rejectPlaceClaim()

### Phase 5: Cleanup

1. **Update all imports**
   - ownerUserId → createdByUserId
   - PlaceOwner → PlaceCreator

2. **Update UI/components**
   - Show business name as owner
   - Show creator separately if needed

3. **Update tests**

---

## Edge Cases

### 1. Place without business owner
- ownerBusinessId = null
- Only creator can manage (or admin)
- Can be claimed or manually assigned

### 2. User without business
- Can create places
- createdByUserId = user.id
- ownerBusinessId = null
- Later can claim to business

### 3. Admin creates place
- createdByUserId = admin.id
- ownerBusinessId = null
- Can manually assign to business

### 4. Claim approval
- place.ownerBusinessId = claim.businessId
- claim.status = APPROVED
- Notifications sent

---

## Breaking Changes

### Schema
- ✅ ownerUserId → createdByUserId (clean rename)
- ✅ Add ownerBusinessId
- ✅ PlaceClaimRequest.status: string → enum
- ✅ PlaceClaimRequest.businessId: optional → required

### Code
- ✅ All place.ownerUserId → place.createdByUserId
- ✅ All canManageOwnedContent(user, place.ownerUserId) → canManagePlace(user, place)
- ✅ All PlaceOwner relation → PlaceCreator

### API
- ✅ POST /api/business/places - set ownerBusinessId
- ✅ All business place endpoints - use canManagePlace

---

## Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| 1 | Schema update + migration | 1-2h |
| 2 | Access control helpers | 1h |
| 3 | API endpoints update | 3-4h |
| 4 | Services update | 2-3h |
| 5 | Cleanup + tests | 2-3h |
| **Total** | | **9-13h** |

---

## Success Criteria

✅ Place.createdByUserId - audit trail
✅ Place.ownerBusinessId - business ownership
✅ PlaceClaimRequest - enum status, required businessId
✅ canManagePlace() - business-based access
✅ Claim approval - sets ownerBusinessId
✅ Admin assign owner - manual assignment
✅ All endpoints updated
✅ No user-based ownership for Places
✅ Clean naming (no misleading ownerUserId)

