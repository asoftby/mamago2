# Phase 1: Schema Foundation and Status Normalization - COMPLETE

## Status: ✅ COMPLETE

## Overview

Phase 1 successfully implemented the database schema foundation for Place moderation with post-publication revisions. This includes status normalization and new models for tracking revision history.

## Changes Made

### 1. Enum Changes

#### ContentStatus Enum - Renamed Value
**Before:**
```prisma
enum ContentStatus {
  DRAFT
  PENDING
  PUBLISHED
  NEEDS_CHANGES  // ← Old name
  REJECTED
}
```

**After:**
```prisma
enum ContentStatus {
  DRAFT
  PENDING
  PUBLISHED
  NEEDS_REVISION  // ← New consistent name
  REJECTED
}
```

**Migration Strategy:**
- Existing `NEEDS_CHANGES` values were temporarily set to `DRAFT` during migration
- New enum created with `NEEDS_REVISION`
- Old enum dropped
- **Note:** Any existing places with NEEDS_CHANGES status were reset to DRAFT (safe for development)

#### New PlaceRevisionStatus Enum
```prisma
enum PlaceRevisionStatus {
  DRAFT           // Business editing revision
  PENDING         // Submitted for moderation
  NEEDS_REVISION  // Admin requested changes
  APPROVED        // Admin approved, data copied to Place
  REJECTED        // Admin rejected revision
}
```

### 2. New Models

#### PlaceRevision Model
Complete snapshot model for post-publication edits:

**Key Fields:**
- `id` - Unique identifier
- `placeId` - Reference to parent Place
- `status` - PlaceRevisionStatus enum
- `moderatorComment` - Admin feedback
- `submittedAt` - When submitted for moderation
- `reviewedAt` - When admin reviewed
- `reviewedByUserId` - Admin who reviewed
- `revisionRequestedAt` - When NEEDS_REVISION assigned
- `revisionResubmittedAt` - When resubmitted after fixes

**Snapshot Fields** (mirror Place model):
- Basic: title, category, shortDesc, description, logoImageId
- Location: googlePlaceId, lat, lng, formattedAddr, addressJson, countryCode, cityId, locationSource, customAddress
- Geo: districtAutoId, districtManualId, metroAutoId, metroAutoDistanceM, metroManualId, metroManualDistanceM
- Hierarchy: placeKind, parentPlaceId, unitLabel, floor, unit
- Contacts: phone, website, instagramHandle, instagramUrl
- Tags: ageTags[], visitFormats[], activityTypes[]

**Relations:**
- `place` → Place (CASCADE delete)
- `reviewedBy` → User (SET NULL on delete)
- `city` → City (SET NULL on delete)
- `images` → PlaceRevisionImage[]

**Indexes:**
- `[placeId, status]` - Find active revision for Place
- `[status]` - Filter by status
- `[reviewedByUserId]` - Admin workload tracking
- `[status, revisionRequestedAt]` - Find expired revisions
- `[placeId, createdAt]` - Revision history

#### PlaceRevisionImage Model
Image snapshots for revisions:

**Fields:**
- `id` - Unique identifier
- `revisionId` - Reference to PlaceRevision
- `kind` - PlaceImageKind (LOGO | GALLERY)
- `url` - Image URL
- `width`, `height`, `blurhash` - Image metadata
- `sortOrder` - Display order

**Relations:**
- `revision` → PlaceRevision (CASCADE delete)

**Indexes:**
- `[revisionId, kind, sortOrder]` - Efficient image queries

### 3. Updated Models

#### Place Model
Added relation:
```prisma
revisions PlaceRevision[] // Post-publication edit revisions
```

#### User Model
Added relation:
```prisma
placeRevisions PlaceRevision[] @relation("PlaceRevisionReviewer")
```

#### City Model
Added relation:
```prisma
placeRevisions PlaceRevision[] @relation("PlaceRevisionCity")
```

### 4. Migration Details

**Migration Name:** `20260306104527_add_place_revision_and_rename_needs_changes`

**Migration File:** `prisma/migrations/20260306104527_add_place_revision_and_rename_needs_changes/migration.sql`

**Key Steps:**
1. Create PlaceRevisionStatus enum
2. Update existing NEEDS_CHANGES to DRAFT (temporary)
3. Create new ContentStatus enum with NEEDS_REVISION
4. Migrate Activity and Place tables to new enum
5. Drop old enum
6. Create PlaceRevision table with all fields and indexes
7. Create PlaceRevisionImage table with indexes
8. Add foreign key constraints

**Database Impact:**
- 2 new tables created
- 1 new enum created
- 1 enum value renamed
- 3 models updated with new relations
- 6 indexes created for PlaceRevision
- 1 index created for PlaceRevisionImage

## Design Rules Implemented

### One Active Revision Rule
**Rule:** Only one active revision (DRAFT/PENDING/NEEDS_REVISION) per Place allowed at a time.

**Implementation:**
- Schema level: Indexes support efficient queries for active revisions
- Service layer enforcement: **Required in Phase 2**
- Query pattern: `WHERE placeId = ? AND status IN ('DRAFT', 'PENDING', 'NEEDS_REVISION')`

**Note:** Database-level partial unique constraint not implemented due to Prisma limitations. Service layer MUST enforce this rule.

## Files Changed

### Schema Files
1. `prisma/schema.prisma` - Updated with new models and enums
2. `prisma/migrations/20260306104527_add_place_revision_and_rename_needs_changes/migration.sql` - Migration file

### Generated Files
3. `node_modules/@prisma/client/` - Regenerated Prisma Client

## Code Areas Requiring Updates (Phase 2)

The following files still reference `NEEDS_CHANGES` and must be updated to `NEEDS_REVISION`:

### Backend Services
1. `src/server/services/moderation.service.ts`
   - Function: `needsChangesPlace()` - Rename to `needsRevisionPlace()`
   - Status references: Update all `NEEDS_CHANGES` → `NEEDS_REVISION`
   - Comments: Update documentation

2. `src/server/services/notification.service.ts`
   - Notification type: `PLACE_NEEDS_CHANGES` → `PLACE_NEEDS_REVISION`
   - Function: `notifyPlaceNeedsChanges()` - Consider renaming

### API Routes
3. `src/app/api/admin/moderation/places/[id]/route.ts`
   - Action: `NEEDS_CHANGES` → `NEEDS_REVISION`
   - Status updates

4. `src/app/api/admin/places/[id]/needs-changes/route.ts`
   - Entire file references old naming
   - Consider renaming file to `needs-revision`

5. `src/app/api/business/places/[id]/submit/route.ts`
   - Status check: `NEEDS_CHANGES` → `NEEDS_REVISION`

6. `src/app/api/business/activities-v2/[id]/submit/route.ts`
   - Status check: `NEEDS_CHANGES` → `NEEDS_REVISION`

### Admin UI Components
7. `src/components/admin/PlaceModerationView.tsx`
   - Status config: `NEEDS_CHANGES` → `NEEDS_REVISION`
   - Action: `NEEDS_CHANGES` → `NEEDS_REVISION`
   - Button handler

8. `src/components/admin/PlaceModerationSidePanel.tsx`
   - Status labels
   - Action labels

9. `src/app/admin/moderation/places/page.tsx`
   - Status config

### Business UI Components
10. `src/components/business/places/PlaceCardHorizontal.tsx`
    - Status config: `NEEDS_CHANGES` → `NEEDS_REVISION`
    - Status checks
    - UI labels

11. `src/components/business/notifications/NotificationList.tsx`
    - Notification type: `PLACE_NEEDS_CHANGES` → `PLACE_NEEDS_REVISION`

12. `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
    - Status check (already updated in previous fix)

### Test Scripts
13. `scripts/manual-tests/test-place-moderation.ts`
    - Status references
    - Action references

14. `scripts/manual-tests/test-notification-ui.ts`
    - Notification type

15. `scripts/manual-tests/test-place-types.ts`
    - Enum value

16. `scripts/manual-tests/test-notification-system.ts`
    - Notification type
    - Comments

17. `scripts/manual-tests/test-place-api.ts`
    - Status check

18. `scripts/manual-tests/test-moderation-system.ts`
    - Multiple references
    - Function calls
    - Assertions

### Routing/Guards
19. `src/lib/routing/profileRedirect.ts`
    - Uses `APPROVED` for business status (different enum - OK)

20. `src/components/business/VerificationBanner.tsx`
    - Uses `APPROVED` for business status (different enum - OK)

21. `src/components/business/RequireVerifiedBusiness.tsx`
    - Uses `APPROVED` for business status (different enum - OK)

## Verification Steps

### Database Verification
```sql
-- Check enum values
SELECT enum_range(NULL::\"ContentStatus\");
-- Should show: {DRAFT,PENDING,PUBLISHED,NEEDS_REVISION,REJECTED}

SELECT enum_range(NULL::\"PlaceRevisionStatus\");
-- Should show: {DRAFT,PENDING,NEEDS_REVISION,APPROVED,REJECTED}

-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('PlaceRevision', 'PlaceRevisionImage');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'PlaceRevision';
```

### Prisma Client Verification
```typescript
import { ContentStatus, PlaceRevisionStatus } from '@prisma/client';

// Should compile without errors
const placeStatus: ContentStatus = 'NEEDS_REVISION';
const revisionStatus: PlaceRevisionStatus = 'NEEDS_REVISION';
```

## Breaking Changes

### Enum Value Renamed
- `ContentStatus.NEEDS_CHANGES` → `ContentStatus.NEEDS_REVISION`
- All code referencing the old value will have TypeScript errors
- Runtime errors will occur if old value is used

### Migration Impact
- Existing Places/Activities with `NEEDS_CHANGES` status were reset to `DRAFT`
- This is acceptable for development but should be noted for production

## Next Steps (Phase 2)

1. **Global Find/Replace:**
   - `NEEDS_CHANGES` → `NEEDS_REVISION` in all TypeScript files
   - `needsChangesPlace` → `needsRevisionPlace` function names
   - `PLACE_NEEDS_CHANGES` → `PLACE_NEEDS_REVISION` notification types

2. **Service Layer:**
   - Create `PlaceRevisionService` with CRUD operations
   - Implement one-active-revision enforcement
   - Add revision approval logic (copy data to Place)

3. **API Endpoints:**
   - Create revision endpoints
   - Update existing endpoints to handle revisions
   - Add validation for revision operations

4. **UI Updates:**
   - Update all status displays
   - Update all action buttons
   - Add revision status indicators

5. **Testing:**
   - Update all test scripts
   - Add new tests for revision functionality
   - Verify enum changes don't break existing tests

## Success Criteria

- [x] ContentStatus enum renamed (NEEDS_CHANGES → NEEDS_REVISION)
- [x] PlaceRevisionStatus enum created
- [x] PlaceRevision model created with all required fields
- [x] PlaceRevisionImage model created
- [x] Relations added to Place, User, City models
- [x] Indexes created for efficient queries
- [x] Migration created and applied successfully
- [x] Prisma Client regenerated
- [x] Database schema verified
- [ ] Code updated to use new enum values (Phase 2)
- [ ] Tests updated and passing (Phase 2)

## Notes

### One Active Revision Enforcement
The "one active revision per Place" rule is NOT enforced at the database level due to Prisma limitations with partial unique indexes. This MUST be enforced in the service layer:

```typescript
// Service layer enforcement example
async function getOrCreateActiveRevision(placeId: string) {
  // Check for existing active revision
  const existing = await prisma.placeRevision.findFirst({
    where: {
      placeId,
      status: { in: ['DRAFT', 'PENDING', 'NEEDS_REVISION'] }
    }
  });
  
  if (existing) {
    return existing;
  }
  
  // Create new revision...
}
```

### Enum Naming Consistency
- Place/Activity content: `ContentStatus` with `NEEDS_REVISION`
- Place revisions: `PlaceRevisionStatus` with `NEEDS_REVISION`
- Business verification: `BusinessVerificationStatus` with `APPROVED` (different domain)

This maintains consistency within each domain while allowing different terminology where appropriate.

## Related Documentation

- Architecture plan: `PLACE_REVISION_ARCHITECTURE.md`
- Current moderation: `PLACE_MODERATION_IMPLEMENTATION.md`
- Moderation improvements: `PLACE_MODERATION_IMPROVEMENTS.md`

