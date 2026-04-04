# Place Ownership Consistency Audit - Post Refactor

## Executive Summary

Audit completed after business ownership refactor. Found **13 critical legacy references** that bypass new business-based access control and **1 schema inconsistency**.

## Critical Issues (Must Fix)

### 1. Place API Endpoints Using Old Access Control (11 files)

**Location:** `src/app/api/business/places/[id]/*`

These endpoints still use `canManageOwnedContent(user, place.ownerUserId)` instead of `canManagePlaceAsync()`:

1. `src/app/api/business/places/[id]/geo/route.ts` - Line 38
2. `src/app/api/business/places/[id]/delete/route.ts` - Line 43
3. `src/app/api/business/places/[id]/improvement-requests/route.ts` - Line 33
4. `src/app/api/business/places/[id]/location/google/route.ts` - Line 44
5. `src/app/api/business/places/[id]/location/manual/route.ts` - Line 44
6. `src/app/api/business/places/[id]/images/route.ts` - Line 42
7. `src/app/api/business/places/[id]/images/[imageId]/route.ts` - Line 34
8. `src/app/api/business/places/[id]/opening-hours/route.ts` - Lines 64, 114
9. `src/app/api/business/places/[id]/revision/images/route.ts` - Lines 44, 184
10. `src/app/api/business/places/[id]/revision/opening-hours/route.ts` - Line 81

**Problem:** These endpoints query `place.ownerUserId` which no longer exists in schema, then check ownership using old user-based logic.

**Impact:** TypeScript errors + broken access control for business-owned places.

**Fix Required:**
```typescript
// OLD (broken)
const place = await prisma.place.findUnique({
  where: { id },
  select: { ownerUserId: true }
});
if (!canManageOwnedContent(user, place.ownerUserId)) { ... }

// NEW (correct)
const place = await prisma.place.findUnique({
  where: { id },
  select: { createdByUserId: true, ownerBusinessId: true }
});
const canManage = await canManagePlaceAsync(user, place);
if (!canManage) { ... }
```

### 2. PlaceRevision Service Using Old Access Control (1 file)

**Location:** `src/server/services/placeRevision.service.ts`

- Line 117: `if (!canManageOwnedContent(user, place.ownerUserId))`
- Line 217: `if (!canManageOwnedContent(user, revision.place.ownerUserId))`

**Problem:** PlaceRevision service still checks `place.ownerUserId` for access control.

**Impact:** Revision creation/editing broken for business-owned places.

**Fix Required:** Use `canManagePlaceAsync()` instead.

### 3. Place Hierarchy Creation Using Old Schema (1 file)

**Location:** `src/lib/place/hierarchy.ts` - Line 116

```typescript
return await prisma.place.create({
  data: {
    ownerUserId: userId,  // ❌ Field doesn't exist
    ...
  }
});
```

**Problem:** Creates UNIT places with `ownerUserId` instead of `createdByUserId` + `ownerBusinessId`.

**Impact:** UNIT creation will fail with Prisma error.

**Fix Required:**
```typescript
const businessId = await getUserBusinessId(userId);
return await prisma.place.create({
  data: {
    createdByUserId: userId,
    ownerBusinessId: businessId,
    ...
  }
});
```

## Acceptable References (No Action Needed)

### 1. Offer Moderation Notifications

**Location:** `src/server/services/moderation.service.ts`

- Lines 387, 402, 416, 428, 442, 454: `offer.place.ownerUserId`

**Context:** Offer moderation sends notifications to place owner.

**Status:** ⚠️ **Needs Update** - Should use `place.createdByUserId` for notifications (consistent with Place moderation).

**Reason:** Offers don't have direct ownership - they inherit from Place. Notifications should go to place creator.

**Fix:**
```typescript
// Change select
select: { status: true, title: true, place: { select: { createdByUserId: true } } }

// Use in notification
notifyOfferApproved(offerId, offer.title, offer.place.createdByUserId)
```

### 2. Business Model References

**Location:** Multiple files

- `src/lib/auth/placeAccess.ts` - Business.ownerUserId (lines 50, 58, 69, 78)
- `src/server/auth/requireVerifiedBusiness.ts` - Business.ownerUserId (line 15)
- `src/server/services/activity.service.ts` - Business.ownerUserId (line 167)
- Commercial services - Business.ownerUserId

**Context:** Business model itself uses `ownerUserId` (one-to-one with User).

**Status:** ✅ **Acceptable** - Business ownership is user-based (MVP model).

**Note:** Future enhancement could add team members/roles to Business.

### 3. Activity/Event Ownership

**Location:** Multiple files

- Activity model still uses `ownerUserId` (user-based ownership)
- Event edit permissions use `activity.ownerUserId`

**Context:** Activities/Events have different ownership model than Places.

**Status:** ✅ **Acceptable** - Activities are user-owned, not business-owned (different entity).

### 4. TempMedia Ownership

**Location:** `src/server/services/placeRevision.service.ts`

- Lines 294, 344: `tempMedia.ownerUserId`

**Context:** TempMedia tracks which user uploaded media.

**Status:** ✅ **Acceptable** - TempMedia is user-scoped, not business-scoped.

### 5. User Moderation Stats

**Location:** `src/server/services/userModeration.service.ts`

- Line 93: `prisma.place.count({ where: { ownerUserId: userId } })`

**Status:** ❌ **Broken** - Field doesn't exist.

**Fix Required:**
```typescript
prisma.place.count({ 
  where: { 
    OR: [
      { createdByUserId: userId },
      { ownerBusiness: { ownerUserId: userId } }
    ]
  } 
})
```

### 6. PlaceGroupSelector Component

**Location:** `src/components/business/place/PlaceGroupSelector.tsx`

- Line 20: `ownerUserId: string` prop
- Line 48: `const params = new URLSearchParams({ ownerUserId })`

**Status:** ❌ **Broken** - Should use business-based filtering.

**Fix Required:** Change to use `businessId` instead of `ownerUserId`.

### 7. LoadOfferForWizard

**Location:** `src/lib/content-editor/loadOfferForWizard.ts`

- Line 14: `place: { select: { id: true, ownerUserId: true } }`

**Status:** ❌ **Broken** - Field doesn't exist.

**Fix Required:** Change to `createdByUserId` and `ownerBusinessId`.

## Summary Table

| Category | Count | Status | Priority |
|----------|-------|--------|----------|
| Place API endpoints with old access control | 11 | ❌ Critical | P0 |
| PlaceRevision service with old access control | 1 | ❌ Critical | P0 |
| Place hierarchy creation with old schema | 1 | ❌ Critical | P0 |
| Offer moderation notifications | 6 | ⚠️ Update | P1 |
| User moderation stats | 1 | ❌ Broken | P1 |
| PlaceGroupSelector component | 1 | ❌ Broken | P1 |
| LoadOfferForWizard | 1 | ❌ Broken | P1 |
| Business model ownerUserId | ~10 | ✅ OK | - |
| Activity/Event ownerUserId | ~20 | ✅ OK | - |
| TempMedia ownerUserId | 2 | ✅ OK | - |

## Action Items

### P0 - Critical (Blocks Place Management)

1. Update 11 Place API endpoints to use `canManagePlaceAsync()`
2. Update PlaceRevision service access control
3. Fix Place hierarchy UNIT creation

### P1 - High (Breaks Features)

4. Fix Offer moderation notifications to use `place.createdByUserId`
5. Fix user moderation stats query
6. Fix PlaceGroupSelector to use businessId
7. Fix loadOfferForWizard place select

### P2 - Documentation

8. Document that Business.ownerUserId is intentional (MVP model)
9. Document that Activity.ownerUserId is separate ownership model

## Estimated Fix Time

- P0 fixes: ~2 hours (bulk find-replace + testing)
- P1 fixes: ~1 hour
- Total: ~3 hours

## Testing Checklist After Fixes

- [ ] Create place from business cabinet
- [ ] Edit place location (google/manual)
- [ ] Upload place images
- [ ] Set place opening hours
- [ ] Create place revision
- [ ] Create UNIT place in complex
- [ ] Create offer for place
- [ ] Submit offer for moderation
- [ ] Check user moderation stats
- [ ] Use place group selector
