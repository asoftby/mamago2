# Business Verification with NEEDS_INFO Status - Complete

## Status: ✅ COMPLETE & TESTED

## Summary
Implemented complete Business Verification flow with NEEDS_INFO moderation state. The system now supports a three-way moderation decision: Approve, Request More Info, or Reject.

## Implementation

### 1. Database Schema Changes

**Prisma Schema Updates:**
- Added `NEEDS_INFO` to `BusinessVerificationStatus` enum
- Added `isVerified` Boolean field to Business model (default: false)
- Migration: `20260304161514_add_needs_info_status_and_is_verified`

**Status Flow:**
```
DRAFT → PENDING → NEEDS_INFO → PENDING → APPROVED
                ↓                      ↓
              REJECTED              REJECTED
```

### 2. Service Layer

**File:** `src/server/services/businessVerification.service.ts`

**New Function:**
```typescript
needsInfo(businessId, actorUserId, note): Promise<void>
```
- Transitions PENDING → NEEDS_INFO
- Requires comment (mandatory)
- Creates audit log entry

**Updated Functions:**
- `submitForVerification()`: Now accepts DRAFT, REJECTED, or NEEDS_INFO
- `approve()`: Sets `isVerified = true` when approving

### 3. API Routes

**New Route:** `POST /api/admin/business-verification/[id]/needs-info`
- Requires ADMIN or MODERATOR role
- Validates comment is provided
- Calls `needsInfo()` service function

**Existing Routes:**
- `/approve` - unchanged
- `/reject` - unchanged

### 4. Admin UI

**File:** `src/app/admin/b2b/requests/BusinessVerificationSidePanel.tsx`

**Changes:**
- Added "Уточнить данные" button (yellow)
- Updated button layout to vertical stack
- Button order (top to bottom):
  1. Уточнить данные (yellow)
  2. Одобрить (green)
  3. Отклонить (red)
- Updated STATUS_LABELS to include NEEDS_INFO
- Added `handleNeedsInfo()` function

**Validation:**
- Approve: comment optional
- Needs Info: comment REQUIRED
- Reject: comment REQUIRED

### 5. Business Owner UI

**File:** `src/app/business/verification/page.tsx`

**New NEEDS_INFO Section:**
- Warning icon (yellow triangle)
- Title: "Требуется уточнение данных"
- Shows moderator comment (required)
- Blue info box with instructions
- CTA: "Исправить данные" → redirects to /business/onboarding

**Behavior:**
- Form becomes editable when status is NEEDS_INFO
- Editing fields does NOT change status automatically
- Only "Отправить на проверку" button changes status back to PENDING
- This prevents accidental resubmission

### 6. Status Mapping

**File:** `src/server/services/businessStatusMap.ts`

Updated `getEffectiveVerificationStatus()` to include NEEDS_INFO in valid statuses array.

## Status Definitions

| Status | Description | Owner Can Edit | Next Actions |
|--------|-------------|----------------|--------------|
| DRAFT | Not submitted | Yes | Submit |
| PENDING | Under review | No | Admin: Approve/Needs Info/Reject |
| NEEDS_INFO | Requires clarification | Yes | Owner: Edit & Resubmit |
| APPROVED | Verified | No | Create content |
| REJECTED | Rejected | Yes | Owner: Edit & Resubmit |

## Key Rules

### NEEDS_INFO Behavior
1. Moderator comment is REQUIRED
2. Owner sees warning banner with comment
3. Form becomes editable
4. Editing fields does NOT change status
5. Only "Отправить на проверку" changes status to PENDING
6. Prevents accidental resubmission

### REJECTED Behavior
1. Moderator comment is REQUIRED
2. Owner sees error banner with comment
3. Form becomes editable
4. Status remains REJECTED until resubmission

### APPROVED Behavior
1. Sets `business.isVerified = true`
2. Owner redirected to /business/dashboard
3. Can now create Places and Offers

## Testing Evidence

Server logs show successful flow:
```
POST /api/admin/business-verification/.../needs-info 200
GET /admin/b2b/requests?status=NEEDS_INFO 200
GET /business/verification 200
POST /business/onboarding 303
POST /api/admin/business-verification/.../approve 200
GET /business/verification 307 → /business/dashboard
```

## Files Modified

1. `prisma/schema.prisma` - Added NEEDS_INFO enum value, isVerified field
2. `src/server/services/businessVerification.service.ts` - Added needsInfo(), updated submit/approve
3. `src/server/services/businessStatusMap.ts` - Added NEEDS_INFO to valid statuses
4. `src/app/api/admin/business-verification/[id]/needs-info/route.ts` - NEW API route
5. `src/app/admin/b2b/requests/BusinessVerificationSidePanel.tsx` - Added button & handler
6. `src/app/business/verification/page.tsx` - Added NEEDS_INFO UI section

## Manual Test Checklist

- [x] Business submits for verification → status PENDING
- [x] Admin sees PENDING request
- [x] Admin clicks "Уточнить данные" with comment → status NEEDS_INFO
- [x] Business sees NEEDS_INFO banner with moderator comment
- [x] Business can edit form
- [x] Editing fields does NOT change status
- [x] Business clicks "Отправить на проверку" → status PENDING
- [x] Admin clicks "Одобрить" → status APPROVED, isVerified = true
- [x] Business redirected to /business/dashboard
- [x] Admin clicks "Отклонить" with comment → status REJECTED
- [x] Business sees REJECTED banner

## Next Steps (Not Implemented)

### Business Events Creation
After verification is complete, implement:

**New Model: Event**
```prisma
model Event {
  id          String
  businessId  String
  title       String
  description String?
  startsAt    DateTime
  endsAt      DateTime?
  address     String
  ageMin      Int?
  ageMax      Int?
  priceFrom   Float?
  priceTo     Float?
  phone       String?
  website     String?
  images      String[]
  content     String?
  status      EventStatus // DRAFT, PUBLISHED, ARCHIVED
}
```

**Routes:**
- `/business/events` - List events
- `/business/events/new` - Create event
- `/business/events/[id]/edit` - Edit event

**Constraint:**
Only verified businesses (`isVerified = true`) can create events.

## Notes

- TypeScript diagnostics may show false positives until TS server reloads
- Prisma types are correctly generated (verified in node_modules)
- Server is running and all endpoints work correctly
- Migration applied successfully to database
- Clean architecture: service layer handles all business logic
- Audit trail maintained via BusinessVerificationLog
