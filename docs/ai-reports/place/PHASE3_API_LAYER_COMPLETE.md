# Phase 3: API Layer Implementation - COMPLETE

## Status: ✅ COMPLETE

## Overview

Phase 3 successfully implemented the API layer for Place moderation and PlaceRevision flow, exposing the service layer through clean, thin controller routes.

## API Endpoints Created

### Business Revision Endpoints

#### 1. GET /api/business/places/[id]/revision
**Purpose:** Get or create active revision for a published Place

**Auth:** BUSINESS_OWNER only

**Response:**
```json
{
  "revision": {
    "id": "...",
    "placeId": "...",
    "status": "DRAFT",
    "title": "...",
    "description": "...",
    // ... all revision fields
    "images": [...],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Errors:**
- 401: Unauthorized (not logged in or not BUSINESS_OWNER)
- 403: Forbidden (not place owner)
- 404: Place not found
- 400: Can only create revisions for published Places

**Business Logic:**
- Enforces one-active-revision rule
- Creates snapshot from current Place data
- Returns existing revision if active one exists

#### 2. PATCH /api/business/places/[id]/revision
**Purpose:** Save revision draft

**Auth:** BUSINESS_OWNER only

**Request Body:**
```json
{
  "revisionId": "...",
  "data": {
    "title": "Updated Title",
    "description": "Updated description",
    "phone": "+375291234567",
    // ... any PlaceRevisionData fields
  }
}
```

**Response:**
```json
{
  "revision": {
    "id": "...",
    "status": "DRAFT",
    // ... updated fields
  }
}
```

**Errors:**
- 400: revisionId or data missing
- 400: Cannot edit revision with status PENDING/APPROVED/REJECTED
- 403: Not place owner
- 404: Revision not found

#### 3. POST /api/business/places/[id]/revision/submit
**Purpose:** Submit revision for moderation

**Auth:** BUSINESS_OWNER only

**Request Body:**
```json
{
  "revisionId": "..."
}
```

**Response:**
```json
{
  "success": true,
  "revision": {
    "id": "...",
    "status": "PENDING",
    "submittedAt": "2026-03-06T...",
    // ... revision fields
  }
}
```

**Errors:**
- 400: revisionId missing
- 400: Cannot submit from current status
- 403: Not place owner
- 404: Revision not found

### Admin Moderation Endpoints

#### 4. POST /api/admin/moderation/revisions/[id]
**Purpose:** Moderate a PlaceRevision

**Auth:** ADMIN or MODERATOR only

**Request Body:**
```json
{
  "action": "APPROVE" | "NEEDS_REVISION" | "REJECT",
  "comment": "Optional for APPROVE, required for others"
}
```

**Response:**
```json
{
  "success": true,
  "action": "APPROVE"
}
```

**Actions:**
- `APPROVE`: Copy revision data to Place, mark revision APPROVED
- `NEEDS_REVISION`: Request changes, set revisionRequestedAt
- `REJECT`: Reject revision, Place remains unchanged

**Errors:**
- 403: Unauthorized (not admin/moderator)
- 400: Invalid action
- 400: Comment required for NEEDS_REVISION/REJECT
- 400: Cannot moderate from current status
- 404: Revision not found

## Updated Existing Endpoints

### 5. GET /api/business/places/[id]
**Changes:** Now includes `activeRevision` field

**Response:**
```json
{
  "place": {
    "id": "...",
    "status": "PUBLISHED",
    "title": "...",
    // ... all place fields
  },
  "activeRevision": {
    "id": "...",
    "status": "DRAFT" | "PENDING" | "NEEDS_REVISION",
    // ... revision fields
  } | null
}
```

**When activeRevision is included:**
- Only when Place.status === "PUBLISHED"
- Only if active revision exists (DRAFT/PENDING/NEEDS_REVISION)

### 6. PATCH /api/business/places/[id]
**Changes:** Blocks direct edits to published Places

**New Error:**
```json
{
  "error": "PUBLISHED_PLACE_REQUIRES_REVISION",
  "message": "Published places must be edited through revisions. Use /api/business/places/[id]/revision endpoint."
}
```

**Behavior:**
- DRAFT/PENDING/NEEDS_REVISION/REJECTED: Can edit directly
- PUBLISHED: Must use revision endpoint

### 7. POST /api/business/places/[id]/submit
**Changes:** Updated to use NEEDS_REVISION

**Status Check:**
```typescript
// Can submit from: DRAFT, REJECTED, NEEDS_REVISION
// Cannot submit from: PENDING, PUBLISHED
```

### 8. POST /api/admin/moderation/places/[id]
**Changes:** 
- Now uses service layer functions
- Updated to use NEEDS_REVISION instead of NEEDS_CHANGES
- Thinner controller logic

**Actions:**
```json
{
  "action": "APPROVE" | "NEEDS_REVISION" | "REJECT",
  "comment": "Required for NEEDS_REVISION and REJECT"
}
```

**Service Functions Called:**
- `APPROVE` → `approvePlace()`
- `NEEDS_REVISION` → `needsRevisionPlace()`
- `REJECT` → `rejectPlace()`

## Error Handling Strategy

### Status-Specific Errors

All endpoints return clear, actionable error messages:

**Ownership Errors:**
```json
{ "error": "Unauthorized: not place owner" }
{ "error": "Forbidden" }
```

**Status Errors:**
```json
{ "error": "Cannot submit from status: PUBLISHED" }
{ "error": "Cannot edit revision with status: PENDING" }
{ "error": "Can only create revisions for published Places" }
```

**Validation Errors:**
```json
{ "error": "Comment is required for NEEDS_REVISION and REJECT actions" }
{ "error": "revisionId is required" }
```

**Not Found Errors:**
```json
{ "error": "Place not found" }
{ "error": "Revision not found" }
```

### HTTP Status Codes

- `200`: Success
- `400`: Bad request (validation, business logic)
- `401`: Unauthorized (not logged in)
- `403`: Forbidden (wrong role or not owner)
- `404`: Not found
- `500`: Internal server error

### Service Error Mapping

Controllers map service layer errors to appropriate HTTP codes:

```typescript
try {
  await serviceFunction();
} catch (serviceError) {
  const message = serviceError instanceof Error ? serviceError.message : "...";
  
  if (message.includes("not found")) {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  if (message.includes("Unauthorized") || message.includes("not place owner")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message.includes("Cannot")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  
  return NextResponse.json({ error: message }, { status: 400 });
}
```

## Authorization

### Business Owner Routes
- Must be logged in
- Must have role === "BUSINESS_OWNER"
- Must own the Place/Revision

**Checked in:**
- All `/api/business/places/[id]/revision/*` endpoints

### Admin Routes
- Must be logged in
- Must have role === "ADMIN" or "MODERATOR"

**Checked in:**
- `/api/admin/moderation/places/[id]`
- `/api/admin/moderation/revisions/[id]`

## Controller Logic

### Thin Controllers

All routes follow the pattern:
1. Auth check
2. Input validation
3. Call service layer
4. Map service errors to HTTP codes
5. Return response

**Example:**
```typescript
export async function POST(req, { params }) {
  // 1. Auth
  const user = await getCurrentUser();
  if (!user || user.role !== "BUSINESS_OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validation
  const { revisionId } = await req.json();
  if (!revisionId) {
    return NextResponse.json({ error: "revisionId is required" }, { status: 400 });
  }

  // 3. Service call
  try {
    const result = await serviceFunction(revisionId, user.id);
    return NextResponse.json({ success: true, result });
  } catch (serviceError) {
    // 4. Error mapping
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

### No Direct Status Mutation

Controllers never directly update Place/Revision status:
- ❌ `prisma.place.update({ data: { status: "PUBLISHED" } })`
- ✅ `await approvePlace(placeId, adminId)`

## Frontend Payload Changes

### Place GET Response

**Before:**
```json
{
  "place": { ... }
}
```

**After:**
```json
{
  "place": { ... },
  "activeRevision": { ... } | null
}
```

**Frontend Impact:**
- Check `activeRevision` to determine if editing should use revision flow
- Show revision status in UI if exists
- Display moderator comments from revision

### Revision Status Display

Frontend should handle these revision statuses:

```typescript
type RevisionStatus = 
  | "DRAFT"           // Business editing
  | "PENDING"         // Under review
  | "NEEDS_REVISION"  // Admin requested changes
  | "APPROVED"        // Approved (historical)
  | "REJECTED"        // Rejected (historical)
```

**UI Mapping:**
- `DRAFT`: "Редактирование" + [Сохранить] [Отправить]
- `PENDING`: "На модерации" (locked)
- `NEEDS_REVISION`: "Требуются правки" + moderatorComment + [Исправить]
- `APPROVED`: (historical, show in revision history)
- `REJECTED`: (historical, show in revision history)

### Place Status + Revision Status

Frontend needs to handle combinations:

| Place Status | Active Revision | UI Display |
|--------------|----------------|------------|
| DRAFT | null | "Черновик" + edit directly |
| PENDING | null | "На модерации" (locked) |
| PUBLISHED | null | "Опубликовано" + [Редактировать] |
| PUBLISHED | DRAFT | "Опубликовано" + "Редактирование изменений" |
| PUBLISHED | PENDING | "Опубликовано" + "Изменения на проверке" |
| PUBLISHED | NEEDS_REVISION | "Опубликовано" + "Требуются правки" + days |
| REJECTED | null | "Отклонено" + [Исправить] |

### Inactivity Tracking

Frontend can calculate days since revision request:

```typescript
if (activeRevision?.status === "NEEDS_REVISION" && activeRevision.revisionRequestedAt) {
  const days = Math.floor(
    (Date.now() - new Date(activeRevision.revisionRequestedAt).getTime()) 
    / (1000 * 60 * 60 * 24)
  );
  // Show: "Отправлено на доработку X дней назад"
}
```

## Files Created

1. `src/app/api/business/places/[id]/revision/route.ts` - GET/PATCH revision
2. `src/app/api/business/places/[id]/revision/submit/route.ts` - POST submit
3. `src/app/api/admin/moderation/revisions/[id]/route.ts` - POST moderate
4. `scripts/manual-tests/test-place-revision-api.ts` - API documentation script
5. `docs/ai-reports/place/PHASE3_API_LAYER_COMPLETE.md` - This document

## Files Modified

6. `src/app/api/business/places/[id]/route.ts` - Added activeRevision, blocked PUBLISHED edits
7. `src/app/api/business/places/[id]/submit/route.ts` - Updated NEEDS_REVISION
8. `src/app/api/admin/moderation/places/[id]/route.ts` - Use service layer, NEEDS_REVISION

## Backward Compatibility

### Breaking Changes
- PATCH `/api/business/places/[id]` now returns error for PUBLISHED places
- Admin moderation action `NEEDS_CHANGES` → `NEEDS_REVISION`

### Non-Breaking Changes
- GET `/api/business/places/[id]` adds `activeRevision` field (additive)
- New endpoints don't affect existing functionality

## Testing

### Test Script

**File:** `scripts/manual-tests/test-place-revision-api.ts`

Documents all API endpoints with:
- Endpoint URLs
- Request/response formats
- Auth requirements
- Error cases

**Run:**
```bash
npx tsx scripts/manual-tests/test-place-revision-api.ts
```

### Manual Testing Checklist

**Business Flow:**
1. [ ] GET place → includes activeRevision when published
2. [ ] GET revision → creates new revision from published place
3. [ ] GET revision again → returns same revision (one-active-revision)
4. [ ] PATCH revision → updates fields
5. [ ] POST submit → changes status to PENDING
6. [ ] PATCH revision → fails (cannot edit PENDING)

**Admin Flow:**
7. [ ] POST moderate APPROVE → copies data to Place
8. [ ] POST moderate NEEDS_REVISION → sets status, comment
9. [ ] POST moderate REJECT → sets status, comment

**Error Cases:**
10. [ ] PATCH published place → returns error
11. [ ] GET revision for non-published → returns error
12. [ ] Submit without revisionId → returns error
13. [ ] Moderate without comment → returns error

## Next Steps (Phase 4 & 5)

### Phase 4: Business UI

**Place Edit Page:**
- Detect if Place is PUBLISHED
- Load or create revision via GET `/api/business/places/[id]/revision`
- Edit revision fields via PATCH `/api/business/places/[id]/revision`
- Submit via POST `/api/business/places/[id]/revision/submit`
- Show revision status banner
- Display moderator comments for NEEDS_REVISION

**Place Cards:**
- Show revision status if activeRevision exists
- Display "Изменения на проверке" for PENDING
- Display "Требуются правки" + days for NEEDS_REVISION
- Update action buttons based on status

### Phase 5: Admin UI

**Moderation Queue:**
- Include PlaceRevisions with status PENDING
- Show [PLACE] vs [PLACE UPDATE] indicators
- Link to revision moderation page

**Revision Moderation Page:**
- Show comparison view (before/after)
- Highlight changed fields
- Use POST `/api/admin/moderation/revisions/[id]` for actions
- Display revision metadata (submittedAt, etc.)

### Notifications

**New Notification Types Needed:**
- `PLACE_UPDATE_APPROVED` - When revision approved
- `PLACE_UPDATE_NEEDS_REVISION` - When revision needs changes
- `PLACE_UPDATE_REJECTED` - When revision rejected

**Implementation:**
- Add to NotificationType enum
- Create notification service functions
- Call from revision moderation endpoint
- Update notification UI to handle new types

## Success Criteria

- [x] Business revision endpoints created (GET, PATCH, POST)
- [x] Admin revision moderation endpoint created
- [x] Existing endpoints updated (GET place, PATCH place, moderation)
- [x] Thin controller logic using service layer
- [x] Clear status-specific error messages
- [x] Proper authorization checks
- [x] Error mapping from service to HTTP codes
- [x] Frontend payload documented
- [x] API test script created
- [x] Documentation complete
- [ ] Business UI implemented (Phase 4)
- [ ] Admin UI implemented (Phase 5)

## Related Documentation

- Phase 1: `PHASE1_SCHEMA_FOUNDATION_COMPLETE.md`
- Phase 2: `PHASE2_SERVICE_LAYER_COMPLETE.md`
- Architecture: `PLACE_REVISION_ARCHITECTURE.md`

