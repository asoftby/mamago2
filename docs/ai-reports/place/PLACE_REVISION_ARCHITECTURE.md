# Place Revision Architecture - Implementation Plan

## Status: 🚧 PLANNING

## Overview

This document outlines the implementation plan for a robust Place moderation architecture with support for post-publication edits via revisions.

## Goals

1. New Places require moderation before first publication
2. After publication, edits go through moderation without affecting live Place
3. Published Place remains visible while edits are under review
4. Unapproved edits never overwrite live published Place
5. Inactivity tracking for revision requests
6. Clear UX for business users about moderation state

## Current State Analysis

### Existing Status Enum
```prisma
enum ContentStatus {
  DRAFT
  PENDING
  PUBLISHED
  NEEDS_CHANGES  // ← Needs rename to NEEDS_REVISION
  REJECTED
}
```

### Current Place Model
- Has moderation metadata fields (moderatorComment, moderationReviewedAt, etc.)
- Uses ContentStatus for status
- No PlaceRevision model exists
- Post-publication edits directly modify Place (PROBLEM!)

### Issues to Fix
1. **Status naming inconsistency**: `NEEDS_CHANGES` should be `NEEDS_REVISION`
2. **No revision system**: Post-publication edits overwrite live Place
3. **Mixed concerns**: Place model handles both live data and pending edits
4. **No comparison view**: Admins can't see before/after for edits

## Proposed Architecture

### Two-Layer System

**Layer 1: Place (Live/Public Entity)**
- Used by public site
- Always shows approved/published data
- Status: DRAFT → PENDING → PUBLISHED or REJECTED

**Layer 2: PlaceRevision (Pending Edits)**
- Stores edits to published Places
- Reviewed by admins
- When approved, data copied to Place
- Status: DRAFT → PENDING → APPROVED/NEEDS_REVISION/REJECTED

### Status Models

**Place Status** (ContentStatus enum - rename NEEDS_CHANGES):
- `DRAFT` - Initial creation, not submitted
- `PENDING` - Submitted for first moderation
- `PUBLISHED` - Approved and live on public site
- `REJECTED` - Rejected during initial moderation

**PlaceRevision Status** (new enum):
- `DRAFT` - Business editing revision
- `PENDING` - Submitted for moderation
- `NEEDS_REVISION` - Admin requested changes
- `APPROVED` - Admin approved, data copied to Place
- `REJECTED` - Admin rejected revision

## Implementation Phases

### Phase 1: Database Schema Changes

#### 1.1 Rename ContentStatus.NEEDS_CHANGES → NEEDS_REVISION
```prisma
enum ContentStatus {
  DRAFT
  PENDING
  PUBLISHED
  NEEDS_REVISION  // ← Renamed from NEEDS_CHANGES
  REJECTED
}
```

**Impact**: Need to update all code references

#### 1.2 Create PlaceRevisionStatus Enum
```prisma
enum PlaceRevisionStatus {
  DRAFT
  PENDING
  NEEDS_REVISION
  APPROVED
  REJECTED
}
```

#### 1.3 Create PlaceRevision Model
```prisma
model PlaceRevision {
  id        String               @id @default(cuid())
  placeId   String
  status    PlaceRevisionStatus  @default(DRAFT)
  
  // Moderation metadata
  moderatorComment      String?
  submittedAt           DateTime?
  reviewedAt            DateTime?
  reviewedByUserId      String?
  revisionRequestedAt   DateTime?  // When NEEDS_REVISION assigned
  revisionResubmittedAt DateTime?  // When resubmitted after fixes
  
  // Snapshot of editable Place fields
  title                 String?
  category              String?
  shortDesc             String?
  description           String?
  logoImageId           String?
  
  // Location
  googlePlaceId         String?
  lat                   Float?
  lng                   Float?
  formattedAddr         String?
  addressJson           Json?
  countryCode           String?
  cityId                String?
  locationSource        LocationSource?
  customAddress         String?
  
  // Geo enrichment
  districtAutoId        String?
  districtManualId      String?
  metroAutoId           String?
  metroAutoDistanceM    Int?
  metroManualId         String?
  metroManualDistanceM  Int?
  
  // Hierarchy
  placeKind             PlaceKind?
  parentPlaceId         String?
  unitLabel             String?
  floor                 String?
  unit                  String?
  
  // Contacts
  phone                 String?
  website               String?
  instagramHandle       String?
  instagramUrl          String?
  
  // Tags
  ageTags               String[]
  visitFormats          String[]
  activityTypes         String[]
  
  // Relations
  place                 Place     @relation(fields: [placeId], references: [id], onDelete: Cascade)
  reviewedBy            User?     @relation(fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  images                PlaceRevisionImage[]
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  @@index([placeId, status])
  @@index([status])
  @@index([reviewedByUserId])
  @@index([status, revisionRequestedAt])
}
```

#### 1.4 Create PlaceRevisionImage Model
```prisma
model PlaceRevisionImage {
  id         String        @id @default(cuid())
  revisionId String
  url        String
  kind       PlaceImageKind
  sortOrder  Int           @default(0)
  
  revision   PlaceRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  
  createdAt  DateTime      @default(now())
  
  @@index([revisionId])
  @@index([revisionId, sortOrder])
}
```

#### 1.5 Add Relation to Place Model
```prisma
model Place {
  // ... existing fields ...
  revisions  PlaceRevision[]
  // ... rest of model ...
}
```

### Phase 2: Service Layer

#### 2.1 Create PlaceRevisionService
```typescript
// src/server/services/placeRevision.service.ts

/**
 * Get or create active revision for a published Place
 * Returns existing DRAFT/PENDING/NEEDS_REVISION revision or creates new DRAFT
 */
export async function getOrCreateActiveRevision(
  placeId: string,
  userId: string
): Promise<PlaceRevision>

/**
 * Save revision draft (updates fields)
 */
export async function saveRevisionDraft(
  revisionId: string,
  data: Partial<PlaceRevisionData>
): Promise<PlaceRevision>

/**
 * Submit revision for moderation
 */
export async function submitRevisionForModeration(
  revisionId: string,
  userId: string
): Promise<PlaceRevision>

/**
 * Approve revision (copy data to Place)
 */
export async function approveRevision(
  revisionId: string,
  adminId: string
): Promise<void>

/**
 * Request changes for revision
 */
export async function requestRevisionChanges(
  revisionId: string,
  adminId: string,
  comment: string
): Promise<void>

/**
 * Reject revision
 */
export async function rejectRevision(
  revisionId: string,
  adminId: string,
  comment: string
): Promise<void>

/**
 * Get active revision for Place (if exists)
 */
export async function getActiveRevision(
  placeId: string
): Promise<PlaceRevision | null>

/**
 * Check if Place has active revision
 */
export async function hasActiveRevision(
  placeId: string
): Promise<boolean>
```

#### 2.2 Update ModerationService
Keep existing functions for initial Place moderation:
- `submitPlace()` - For initial DRAFT → PENDING
- `approvePlace()` - For initial PENDING → PUBLISHED
- `rejectPlace()` - For initial PENDING → REJECTED

Add new notification types:
- `PLACE_UPDATE_APPROVED` - When revision approved
- `PLACE_UPDATE_NEEDS_REVISION` - When revision needs changes
- `PLACE_UPDATE_REJECTED` - When revision rejected

### Phase 3: API Endpoints

#### 3.1 New Revision Endpoints
```
GET    /api/business/places/[id]/revision
POST   /api/business/places/[id]/revision
PATCH  /api/business/places/[id]/revision
POST   /api/business/places/[id]/revision/submit
```

#### 3.2 Update Existing Endpoints
```
GET    /api/business/places/[id]
  → Include activeRevision if exists

PATCH  /api/business/places/[id]
  → If PUBLISHED, edit revision instead of Place
  → If DRAFT/PENDING/REJECTED, edit Place directly

POST   /api/business/places/[id]/submit
  → Only for initial moderation (DRAFT → PENDING)
```

#### 3.3 Admin Moderation Endpoints
```
GET    /api/admin/moderation/queue
  → Include both initial Places and PlaceRevisions

GET    /api/admin/moderation/places/[id]
  → Include comparison view if revision exists

POST   /api/admin/moderation/places/[id]
  → Handle initial Place moderation

POST   /api/admin/moderation/revisions/[id]
  → Handle revision moderation (approve/needs-revision/reject)
```

### Phase 4: Business Dashboard UI

#### 4.1 Update PlaceCardHorizontal
Show different states:
- DRAFT: "Черновик" + "Продолжить"
- PENDING: "На модерации" (disabled)
- PUBLISHED (no revision): "Опубликовано" + "Редактировать"
- PUBLISHED + revision PENDING: "Опубликовано" + "Изменения на проверке"
- PUBLISHED + revision NEEDS_REVISION: "Опубликовано" + "Требуются правки" + days since
- REJECTED: "Отклонено" + "Исправить"

#### 4.2 Update Place Edit Page
Route: `/business/places/[id]/edit`

**For DRAFT/PENDING/REJECTED Places:**
- Edit Place directly
- Show "Сохранить черновик" + "Отправить на модерацию"

**For PUBLISHED Places:**
- Load or create active revision
- Edit revision, not Place
- Show revision status banner
- If NEEDS_REVISION, show moderator comment
- Show "Сохранить" + "Отправить на модерацию"

### Phase 5: Admin UI

#### 5.1 Moderation Queue
Route: `/admin/moderation/queue`

Show combined list:
- Initial Places (Place.status = PENDING)
- Place Updates (PlaceRevision.status = PENDING)

Each item shows:
- Type: [PLACE] or [PLACE UPDATE]
- Title
- Business name
- City
- Submitted date
- Status

#### 5.2 Moderation Detail Page
Route: `/admin/moderation/places/[id]` or `/admin/moderation/revisions/[id]`

**Two-column layout:**

**Left: Content Preview**
- For initial Place: Show Place data
- For revision: Show comparison (before/after)
  - Current live Place
  - Proposed changes in revision
  - Highlight differences

**Right: Sticky Moderation Panel**
- Moderation type (Initial / Update)
- Current status
- Business info
- Submitted date
- Moderator comment textarea
- Action buttons:
  - Approve
  - Needs Revision
  - Reject

### Phase 6: Migration Strategy

#### 6.1 Data Migration
```sql
-- Rename enum value
ALTER TYPE "ContentStatus" RENAME VALUE 'NEEDS_CHANGES' TO 'NEEDS_REVISION';
```

#### 6.2 Code Migration
1. Global find/replace: `NEEDS_CHANGES` → `NEEDS_REVISION`
2. Update all imports and references
3. Update UI text strings
4. Update API error messages

#### 6.3 Backward Compatibility
- Existing Places continue to work
- No data loss
- Gradual rollout possible

## Testing Strategy

### Unit Tests
- PlaceRevisionService functions
- Status transitions
- One active revision rule
- Data copying on approval

### Integration Tests
- Create revision for published Place
- Submit revision for moderation
- Approve revision (verify data copied)
- Reject revision (verify Place unchanged)
- Multiple revision attempts

### E2E Tests
1. Create Place → Submit → Approve → Publish
2. Edit published Place → Creates revision
3. Submit revision → Admin approves → Changes live
4. Edit published Place → Submit → Admin requests changes → Business fixes → Resubmit → Approve

## Rollout Plan

### Stage 1: Schema + Services (Backend Only)
- Add PlaceRevision model
- Create PlaceRevisionService
- Add API endpoints
- No UI changes yet

### Stage 2: Business UI
- Update Place edit page to use revisions
- Update Place cards to show revision status
- Add revision status banners

### Stage 3: Admin UI
- Add revision moderation to queue
- Add comparison view
- Add revision moderation actions

### Stage 4: Notifications
- Add PLACE_UPDATE_* notification types
- Create notifications on revision actions

### Stage 5: Cleanup
- Remove old moderation fields from Place (if desired)
- Archive old moderation logs
- Performance optimization

## Success Criteria

- [ ] Published Places remain visible during edit review
- [ ] Admins can see before/after comparison
- [ ] Business users understand moderation state
- [ ] One active revision per Place enforced
- [ ] Revision approval copies data to Place
- [ ] Notifications created for revision actions
- [ ] Inactivity tracking works
- [ ] All tests pass
- [ ] Documentation complete

## Out of Scope

- Duplicate detection
- Moderation for Offers/Events/Routes
- Automated moderation
- Email/push notification delivery
- Advanced merge/conflict resolution
- Multiple active revisions per Place

## Related Documentation

- Current moderation: `PLACE_MODERATION_IMPLEMENTATION.md`
- Moderation improvements: `PLACE_MODERATION_IMPROVEMENTS.md`
- Notification system: `PLACE_APPROVAL_NOTIFICATIONS.md`

## Next Steps

1. Review and approve this architecture
2. Create Prisma migration for schema changes
3. Implement PlaceRevisionService
4. Create API endpoints
5. Update business UI
6. Update admin UI
7. Add tests
8. Deploy to staging
9. User acceptance testing
10. Deploy to production

