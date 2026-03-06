# ✅ Unified Moderation System - COMPLETE

## Overview

Implemented a unified moderation system for Place (and extensible to Activity) that reuses the Business Verification pattern with ContentStatus enum and ModerationLog.

## Database Schema

### Enums

```prisma
enum ContentStatus {
  DRAFT           // Initial state, being edited
  PENDING         // Submitted for moderation
  PUBLISHED       // Approved and visible
  NEEDS_CHANGES   // Moderator requested changes
  REJECTED        // Permanently rejected
}

enum ModerationEntityType {
  PLACE
  ACTIVITY
}

enum ModerationAction {
  SUBMIT
  APPROVE
  NEEDS_CHANGES
  REJECT
}
```

### ModerationLog Model

```prisma
model ModerationLog {
  id               String               @id @default(cuid())
  entityType       ModerationEntityType
  entityId         String
  action           ModerationAction
  message          String?
  reviewedByUserId String?
  reviewedBy       User?                @relation(...)
  createdAt        DateTime             @default(now())
  
  @@index([entityType, entityId, createdAt])
  @@index([reviewedByUserId])
}
```

## Service Layer

### `src/server/services/moderation.service.ts`

Centralized moderation logic with functions:

**Core Functions:**
- `logModeration()` - Create moderation log entry
- `getModerationLogs()` - Get all logs for an entity
- `getLatestModerationMessage()` - Get latest moderator message

**Place Moderation:**
- `submitPlace()` - DRAFT/NEEDS_CHANGES/REJECTED → PENDING
- `approvePlace()` - PENDING → PUBLISHED
- `needsChangesPlace()` - PENDING → NEEDS_CHANGES (message required)
- `rejectPlace()` - PENDING → REJECTED (message required)

**Validation Rules:**
- Can only submit from DRAFT, NEEDS_CHANGES, or REJECTED
- Can only moderate from PENDING status
- Message is required for NEEDS_CHANGES and REJECT actions
- All actions are logged with timestamp and reviewer

## API Endpoints

### Admin Endpoints

**GET /api/admin/places/[id]**
- Get Place details with moderation logs
- Admin/Moderator only
- Returns full place data + owner info + moderation history

**POST /api/admin/places/[id]/approve**
- Approve Place (PENDING → PUBLISHED)
- Optional note parameter
- Admin/Moderator only

**POST /api/admin/places/[id]/needs-changes**
- Request changes (PENDING → NEEDS_CHANGES)
- Required: `message` parameter
- Admin/Moderator only

**POST /api/admin/places/[id]/reject**
- Reject Place (PENDING → REJECTED)
- Required: `message` parameter
- Admin/Moderator only

### Business Endpoints

**POST /api/business/places/[id]/submit**
- Updated to use `submitPlace()` service
- Creates moderation log entry
- Validates all required fields before submission

## UI Components

### Admin UI

**`src/components/admin/PlaceModerationSidePanel.tsx`**
- Reusable side panel for Place moderation
- Pattern matches BusinessVerificationSidePanel
- Features:
  - Full place details with images
  - Owner information
  - Moderation history timeline
  - Action buttons (Approve, Needs Changes, Reject)
  - Required message for Needs Changes and Reject
  - Confirmation dialogs

### Business Owner UI

**Place Wizard Banner**
- Shows moderation message when status = NEEDS_CHANGES or REJECTED
- Yellow banner for NEEDS_CHANGES
- Red banner for REJECTED
- Displays latest moderator comment
- Integrated into PlaceWizard component

**Updated Components:**
- `PlaceWizard.tsx` - Added moderation message banner
- `page.tsx` - Fetches latest moderation message

## Status Flow

```
DRAFT
  ↓ (submit)
PENDING
  ↓ (approve)        ↓ (needs_changes)      ↓ (reject)
PUBLISHED        NEEDS_CHANGES           REJECTED
                      ↓ (submit)              ↓ (submit)
                    PENDING                 PENDING
```

## Key Features

1. **Polymorphic Design**
   - ModerationLog supports multiple entity types (PLACE, ACTIVITY)
   - Easy to extend to other content types

2. **Audit Trail**
   - All moderation actions are logged
   - Includes timestamp, action, message, and reviewer
   - Full history visible to admins and business owners

3. **Required Comments**
   - NEEDS_CHANGES and REJECT require moderator message
   - Ensures business owners know what to fix

4. **Reusable Pattern**
   - Mirrors Business Verification workflow
   - Consistent UX across different moderation types
   - Service layer abstracts business logic

5. **Business Owner Feedback**
   - Clear banners showing moderation status
   - Latest moderator message displayed prominently
   - Can resubmit after fixing issues

## Migration

**Migration:** `20260304211431_unified_moderation_log`
- Created ModerationLog table
- Added relation to User model
- Indexes for efficient queries

## Testing Checklist

### Admin Flow
- [ ] Admin can view Place details in side panel
- [ ] Admin can approve Place (PENDING → PUBLISHED)
- [ ] Admin can request changes with message (PENDING → NEEDS_CHANGES)
- [ ] Admin can reject with message (PENDING → REJECTED)
- [ ] Moderation history shows all actions
- [ ] Cannot moderate from non-PENDING status

### Business Owner Flow
- [ ] Can submit Place from DRAFT
- [ ] Can resubmit from NEEDS_CHANGES
- [ ] Can resubmit from REJECTED
- [ ] Cannot submit from PENDING or PUBLISHED
- [ ] Sees moderation message banner when NEEDS_CHANGES
- [ ] Sees rejection message banner when REJECTED
- [ ] Submit validates all required fields

### Moderation Logs
- [ ] All actions are logged
- [ ] Logs include timestamp and reviewer
- [ ] Latest message is retrievable
- [ ] History is ordered by date (newest first)

## Future Extensions

### Activity Moderation
To add Activity moderation:

1. Update Activity model to use ContentStatus
2. Add Activity functions to moderation.service.ts:
   - `submitActivity()`
   - `approveActivity()`
   - `needsChangesActivity()`
   - `rejectActivity()`
3. Create admin API endpoints for Activity
4. Create ActivityModerationSidePanel component
5. Add moderation banner to Activity form

### Other Content Types
The system is designed to support any content type:
- Add new value to ModerationEntityType enum
- Implement service functions for that entity
- Create admin UI components
- Add business owner feedback UI

## Files Created/Modified

### Created
- `src/server/services/moderation.service.ts`
- `src/app/api/admin/places/[id]/route.ts`
- `src/app/api/admin/places/[id]/approve/route.ts`
- `src/app/api/admin/places/[id]/needs-changes/route.ts`
- `src/app/api/admin/places/[id]/reject/route.ts`
- `src/components/admin/PlaceModerationSidePanel.tsx`
- `prisma/migrations/20260304211431_unified_moderation_log/migration.sql`

### Modified
- `prisma/schema.prisma` - Added ModerationLog model and enums
- `src/app/api/business/places/[id]/submit/route.ts` - Use moderation service
- `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx` - Added banner
- `src/app/business/(protected)/places/[id]/edit/page.tsx` - Fetch moderation message

## Summary

The unified moderation system provides a consistent, auditable workflow for content moderation across Place and future content types. It reuses proven patterns from Business Verification, ensures moderator feedback reaches business owners, and maintains a complete audit trail of all moderation actions.
