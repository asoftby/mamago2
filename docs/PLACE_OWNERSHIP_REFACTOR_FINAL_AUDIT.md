# Place Ownership Refactor - Final Audit

## Status: ✅ P0 Complete, P1 Remaining

## P0 - Critical Fixes (COMPLETE)

### ✅ 1. Place API Endpoints (11 files) - FIXED
All endpoints now use `canManagePlaceAsync()` with business-based access:

- ✅ `/geo` - Updated
- ✅ `/delete` - Updated
- ✅ `/improvement-requests` - Updated
- ✅ `/location/google` - Updated
- ✅ `/location/manual` - Updated
- ✅ `/images` - Updated
- ✅ `/images/[imageId]` - Already fixed
- ✅ `/opening-hours` - Updated (GET method)
- ✅ `/revision/images` - Updated (POST and DELETE)
- ✅ `/revision/opening-hours` - Updated

### ✅ 2. PlaceRevision Service - FIXED
Updated `src/server/services/placeRevision.service.ts`:
- ✅ Line 117: `getOrCreatePlaceRevision()` - Uses `canManagePlaceAsync()`
- ✅ Line 217: `savePlaceRevisionDraft()` - Uses `canManagePlaceAsync()`
- ✅ Line 410: `submitPlaceRevision()` - Uses `canManagePlaceAsync()`

### ✅ 3. Place Hierarchy - FIXED
Updated `src/lib/place/hierarchy.ts`:
- ✅ UNIT creation now uses `createdByUserId` + `ownerBusinessId`
- ✅ Calls `getUserBusinessId()` to get user's business

## P1 - High Priority (REMAINING)

### ✅ 4. Offer Moderation Notifications - ALREADY FIXED
Checked `src/server/services/moderation.service.ts`:
- No references to `offer.place.ownerUserId` found
- Appears to have been fixed in earlier refactor

### ❌ 5. User Moderation Stats - NEEDS FIX
**File:** `src/server/services/userModeration.service.ts` - Line 93

**Current (broken):**
```typescript
prisma.place.count({ where: { ownerUserId: userId } })
```

**Should be:**
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

### ❌ 6. PlaceGroupSelector Component - NEEDS FIX
**File:** `src/components/business/place/PlaceGroupSelector.tsx`

**Issues:**
- Line 20: `ownerUserId: string` prop
- Line 48: `const params = new URLSearchParams({ ownerUserId })`

**Should use:** `businessId` instead of `ownerUserId`

### ❌ 7. LoadOfferForWizard - NEEDS FIX
**File:** `src/lib/content-editor/loadOfferForWizard.ts` - Line 14

**Current (broken):**
```typescript
place: { select: { id: true, ownerUserId: true } }
```

**Should be:**
```typescript
place: { select: { id: true, createdByUserId: true, ownerBusinessId: true } }
```

## Verification Queries

Run these to verify no remaining `place.ownerUserId` references:

```bash
# Check for ownerUserId in Place context
grep -r "place\.ownerUserId" src/app/api/business/places/
grep -r "place\.ownerUserId" src/server/services/
grep -r "place\.ownerUserId" src/lib/

# Check for canManageOwnedContent in Place endpoints
grep -r "canManageOwnedContent" src/app/api/business/places/

# Check Prisma selects with ownerUserId
grep -r "select.*ownerUserId" src/app/api/business/places/
```

## Summary

**P0 Complete:** 13/13 critical fixes applied
- All Place API endpoints use business-based access
- PlaceRevision service uses business-based access
- Place hierarchy UNIT creation uses new schema

**P1 Remaining:** 3 items
- User moderation stats query
- PlaceGroupSelector component
- loadOfferForWizard select

**Estimated time for P1:** ~30 minutes

## Next Steps

1. Fix user moderation stats query
2. Update PlaceGroupSelector to use businessId
3. Fix loadOfferForWizard place select
4. Run TypeScript compilation check
5. Run final ownership consistency audit
