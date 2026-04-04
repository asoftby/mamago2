# Place Business Ownership Refactor - Complete

## Summary

Successfully refactored Place ownership model from user-based to business-based ownership. This is a clean refactor with no legacy data to migrate (database was empty).

## Changes Made

### 1. Database Schema (Prisma)

**Place Model:**
- `ownerUserId` → `createdByUserId` (who created the place)
- Added `ownerBusinessId` (which business owns the place, nullable)
- Updated relation names:
  - `owner` → `creator` (User relation)
  - `PlaceOwner` → `PlaceCreator` (inverse relation)
  - Added `ownerBusiness` (Business relation)
  - Added `ownedPlaces` (inverse Business relation)

**PlaceGroup Model:**
- `ownerUserId` → `createdByUserId`
- Added `ownerBusinessId`
- Updated relations to match Place model

**PlaceClaimRequest Model:**
- `status: String` → `status: PlaceClaimRequestStatus` (enum)
- `businessId` is now required (not optional)
- Enum values: PENDING, APPROVED, REJECTED, CANCELED

**Migration:**
- Created: `20260404131009_place_business_ownership_refactor`
- Applied successfully

### 2. Access Control

**New Helper: `src/lib/auth/placeAccess.ts`**
- `canManagePlace()` - sync check if user can manage place
- `canManagePlaceAsync()` - async check with business verification
- `canAccessBusiness()` - check if user owns/can access business
- `getUserBusinessId()` - get user's business ID

**Access Rules:**
- Admin/Moderator: full access to all places
- If place has business owner: user must own that business
- If place has no business owner: only creator can manage

### 3. API Endpoints Updated

**Business Place Endpoints:**
- `POST /api/business/places` - Create with `createdByUserId` + `ownerBusinessId`
- `GET /api/business/places` - List places created by user OR owned by their business
- `GET /api/business/places/[id]` - Uses `canManagePlaceAsync()`
- `PATCH /api/business/places/[id]` - Uses `canManagePlaceAsync()`
- `DELETE /api/business/places/[id]` - Uses `canManagePlaceAsync()`
- `POST /api/business/places/[id]/submit` - Uses `canManagePlaceAsync()`
- `POST /api/business/places/[id]/claim` - Requires businessId, checks business ownership
- `POST /api/business/places/[id]/group` - Uses business-based access

**New Admin Claim Endpoints:**
- `GET /api/admin/places/claims` - List pending claim requests
- `POST /api/admin/places/claims/[id]/approve` - Approve claim (sets ownerBusinessId)
- `POST /api/admin/places/claims/[id]/reject` - Reject claim
- `POST /api/admin/places/[id]/assign-owner` - Manual business owner assignment

### 4. Services Updated

**`src/server/services/place.service.ts`:**
- `getBusinessPlaces()` - Returns places created by user OR owned by their business
- `userCanManagePlace()` - Uses business-based access
- `getPlaceForOwner()` - Uses `canManagePlaceAsync()`, includes creator and ownerBusiness

**`src/server/services/moderation.service.ts`:**
- Updated all notification calls to use `createdByUserId` instead of `ownerUserId`
- Functions updated: `approvePlace()`, `needsRevisionPlace()`, `rejectPlace()`, `submitPlace()`, `publishPlaceFromDraft()`

**New: `src/server/services/placeClaim.service.ts`:**
- `getPendingClaimRequests()` - Get all pending claims
- `getClaimRequest()` - Get single claim with details
- `approvePlaceClaim()` - Approve claim, set place.ownerBusinessId
- `rejectPlaceClaim()` - Reject claim with note
- `manuallyAssignPlaceOwner()` - Admin manual assignment

**`src/server/services/placeArchive.service.ts`:**
- Uses updated `getPlaceForOwner()` with business-based access

### 5. Permissions Updated

**`src/lib/permissions/placeEditPermissions.ts`:**
- `canEditPlace()` - Now async, uses `canManagePlaceAsync()`
- `PlaceEditContext` - Updated to use `createdByUserId` and `ownerBusinessId`

**`src/lib/permissions/offerEditPermissions.ts`:**
- `canEditOfferForUser()` - Now async, uses `canManagePlaceAsync()` on offer.place

### 6. UI Components Updated

**`src/components/business/wizard/place/types.ts`:**
- `PlaceFormData` - Updated to use `createdByUserId` and `ownerBusinessId`

**`src/components/business/wizard/place/mappers.ts`:**
- `mapPlaceToFormData()` - Maps new ownership fields

### 7. Public Visibility Updated

**`src/server/business/businessOperationalPrisma.ts`:**
- `placeOwnerBusinessActiveWhere` - Updated to check `ownerBusiness.operationalStatus`
- Places without business owner OR with active business owner are visible

**`src/app/(public)/places/[slug]/page.tsx`:**
- Updated to use `ownerBusiness` relation instead of `owner.business`

### 8. Editor Pages Updated

**`src/app/(content-editor)/editor/place/[id]/edit/page.tsx`:**
- Updated to use async `canEditPlace()` with new ownership fields

**`src/app/(content-editor)/editor/offer/[id]/edit/page.tsx`:**
- Updated to use async `canEditOfferForUser()`

**`src/app/(content-editor)/editor/offer/new/page.tsx`:**
- Updated place query to find places by `createdByUserId` OR `ownerBusinessId`

## Ownership Model

### Creator vs Owner

- **Creator** (`createdByUserId`): User who created the place record
  - Used for audit trail
  - Used for notifications
  - If no business owner, creator can manage

- **Owner** (`ownerBusinessId`): Business that owns the place
  - Used for access control
  - Can be null (unowned places)
  - Set via claim approval or manual assignment

### Access Flow

1. User creates place → `createdByUserId` = user, `ownerBusinessId` = user's business (if exists)
2. User claims place → Creates PlaceClaimRequest with required businessId
3. Admin approves claim → `place.ownerBusinessId` = claim.businessId
4. Admin manually assigns → `place.ownerBusinessId` = selected businessId

### Claim Workflow

1. Business user submits claim: `POST /api/business/places/[id]/claim`
   - Requires user to have a business
   - Creates PlaceClaimRequest with status PENDING

2. Admin reviews claims: `GET /api/admin/places/claims`
   - Lists all pending claims with place and business details

3. Admin approves: `POST /api/admin/places/claims/[id]/approve`
   - Sets `place.ownerBusinessId = claim.businessId`
   - Updates claim status to APPROVED

4. Admin rejects: `POST /api/admin/places/claims/[id]/reject`
   - Requires rejection note
   - Updates claim status to REJECTED
   - Does not change place ownership

## Files Changed

### Schema & Migration
- `prisma/schema.prisma`
- `prisma/migrations/20260404131009_place_business_ownership_refactor/migration.sql`

### Access Control
- `src/lib/auth/placeAccess.ts` (new)
- `src/lib/permissions/placeEditPermissions.ts`
- `src/lib/permissions/offerEditPermissions.ts`

### API Endpoints
- `src/app/api/business/places/route.ts`
- `src/app/api/business/places/[id]/route.ts`
- `src/app/api/business/places/[id]/submit/route.ts`
- `src/app/api/business/places/[id]/claim/route.ts`
- `src/app/api/business/places/[id]/group/route.ts`
- `src/app/api/admin/places/claims/route.ts` (new)
- `src/app/api/admin/places/claims/[id]/approve/route.ts` (new)
- `src/app/api/admin/places/claims/[id]/reject/route.ts` (new)
- `src/app/api/admin/places/[id]/assign-owner/route.ts` (new)

### Services
- `src/server/services/place.service.ts`
- `src/server/services/moderation.service.ts`
- `src/server/services/placeClaim.service.ts` (new)

### UI Components
- `src/components/business/wizard/place/types.ts`
- `src/components/business/wizard/place/mappers.ts`

### Pages
- `src/app/(content-editor)/editor/place/[id]/edit/page.tsx`
- `src/app/(content-editor)/editor/offer/[id]/edit/page.tsx`
- `src/app/(content-editor)/editor/offer/new/page.tsx`
- `src/app/(public)/places/[slug]/page.tsx`

### Utilities
- `src/server/business/businessOperationalPrisma.ts`

## Testing Checklist

- [ ] Create place from business cabinet → ownerBusinessId set
- [ ] Create place from admin → ownerBusinessId null
- [ ] List places shows created + business-owned places
- [ ] Edit place checks business ownership
- [ ] Submit claim requires business
- [ ] Admin can list pending claims
- [ ] Admin can approve claim → ownership transferred
- [ ] Admin can reject claim → ownership unchanged
- [ ] Admin can manually assign owner
- [ ] Public visibility respects business operational status
- [ ] Notifications sent to creator
- [ ] Place groups use business ownership

## Next Steps

1. Update admin UI to show claim management interface
2. Add notifications for claim approval/rejection
3. Update place list UI to show business owner
4. Add business owner filter to admin place list
5. Consider adding business team members/roles in future
6. Add tests for new claim workflow

## Notes

- Clean refactor with no legacy data migration needed
- All ownership checks now go through business-based access control
- Creator field preserved for audit trail and notifications
- Claim workflow requires business (no individual claims)
- Admin can manually assign ownership without claim process
