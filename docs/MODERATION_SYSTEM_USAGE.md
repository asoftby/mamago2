# Moderation System Usage Guide

## Overview

The unified moderation system provides a consistent workflow for moderating user-generated content (Places, Activities, etc.) with audit trails and business owner feedback.

## For Business Owners

### Submitting Content for Review

1. Create your Place in DRAFT status
2. Fill in all required fields:
   - Title, category, short description
   - Logo image
   - Location (coordinates + source)
   - For UNITs: parent place, floor, unit
3. Click "Submit for Moderation"
4. Status changes to PENDING

### If Changes Are Requested

When a moderator requests changes (status = NEEDS_CHANGES):

1. You'll see a yellow banner with the moderator's message
2. Make the requested changes
3. Click "Submit for Moderation" again
4. Status returns to PENDING

### If Content Is Rejected

When content is rejected (status = REJECTED):

1. You'll see a red banner with the rejection reason
2. Review the moderator's feedback
3. Make necessary changes
4. You can resubmit for review

### Status Flow

```
DRAFT → PENDING → PUBLISHED ✅
              ↓
         NEEDS_CHANGES → (fix) → PENDING
              ↓
         REJECTED → (fix) → PENDING
```

## For Moderators/Admins

### Reviewing Content

1. Navigate to the moderation queue
2. Click on a Place to open the side panel
3. Review all details:
   - Images (logo and gallery)
   - Place information
   - Owner details
   - Location data
   - Tags and categories

### Moderation Actions

**Approve (PENDING → PUBLISHED)**
```typescript
POST /api/admin/places/[id]/approve
{
  "note": "Optional approval note"
}
```
- Content becomes visible to users
- Optional note for internal records

**Request Changes (PENDING → NEEDS_CHANGES)**
```typescript
POST /api/admin/places/[id]/needs-changes
{
  "message": "Please add more photos and update the description"
}
```
- Message is REQUIRED
- Business owner sees this message
- They can fix and resubmit

**Reject (PENDING → REJECTED)**
```typescript
POST /api/admin/places/[id]/reject
{
  "message": "This place does not meet our quality standards"
}
```
- Message is REQUIRED
- Business owner sees this message
- They can fix and resubmit

### Moderation History

All actions are logged with:
- Timestamp
- Action type (SUBMIT, APPROVE, NEEDS_CHANGES, REJECT)
- Moderator message
- Reviewer email

View history in the side panel or via API:
```typescript
GET /api/admin/places/[id]
```

## For Developers

### Adding Moderation to New Content Types

1. **Update Prisma Schema**
```prisma
enum ModerationEntityType {
  PLACE
  ACTIVITY  // Add new type
}

model YourContent {
  status ContentStatus @default(DRAFT)
  // ... other fields
}
```

2. **Add Service Functions**
```typescript
// src/server/services/moderation.service.ts

export async function submitYourContent(
  contentId: string,
  ownerUserId: string
): Promise<void> {
  // Validate ownership and status
  // Update status to PENDING
  // Log moderation action
}

export async function approveYourContent(
  contentId: string,
  reviewedByUserId: string,
  message?: string
): Promise<void> {
  // Validate status is PENDING
  // Update status to PUBLISHED
  // Log moderation action
}

// Similar for needsChanges and reject
```

3. **Create Admin API Endpoints**
```typescript
// src/app/api/admin/your-content/[id]/approve/route.ts
// src/app/api/admin/your-content/[id]/needs-changes/route.ts
// src/app/api/admin/your-content/[id]/reject/route.ts
```

4. **Create Admin UI Component**
```typescript
// src/components/admin/YourContentModerationSidePanel.tsx
// Follow the pattern from PlaceModerationSidePanel
```

5. **Add Business Owner Feedback**
```typescript
// In your content edit form:
const moderationMessage = await getLatestModerationMessage(
  "YOUR_CONTENT_TYPE",
  contentId
);

// Show banner if status is NEEDS_CHANGES or REJECTED
```

### Using the Service Layer

```typescript
import {
  submitPlace,
  approvePlace,
  needsChangesPlace,
  rejectPlace,
  getModerationLogs,
  getLatestModerationMessage,
} from "@/server/services/moderation.service";

// Submit for moderation
await submitPlace(placeId, userId);

// Approve
await approvePlace(placeId, moderatorId, "Looks good!");

// Request changes
await needsChangesPlace(
  placeId,
  moderatorId,
  "Please add more photos"
);

// Reject
await rejectPlace(
  placeId,
  moderatorId,
  "Does not meet quality standards"
);

// Get history
const logs = await getModerationLogs("PLACE", placeId);

// Get latest message
const message = await getLatestModerationMessage("PLACE", placeId);
```

### Error Handling

The service layer throws errors for invalid operations:

```typescript
try {
  await approvePlace(placeId, moderatorId);
} catch (error) {
  // "Cannot approve from status: PUBLISHED"
  // "Place not found"
  // "Unauthorized: not place owner"
}

try {
  await needsChangesPlace(placeId, moderatorId, "");
} catch (error) {
  // "Message is required for NEEDS_CHANGES status"
}
```

## Best Practices

### For Moderators

1. **Be Specific**: When requesting changes, clearly explain what needs to be fixed
2. **Be Constructive**: Help business owners improve their content
3. **Be Consistent**: Apply the same standards to all content
4. **Document Decisions**: Use the note field to explain your reasoning

### For Developers

1. **Always Use Service Layer**: Don't update status directly in the database
2. **Log All Actions**: Every status change should create a log entry
3. **Validate Status Transitions**: Only allow valid state transitions
4. **Require Messages**: Always require messages for NEEDS_CHANGES and REJECT
5. **Show Feedback**: Display moderation messages to business owners

## Testing

Run the test suite:
```bash
pnpm tsx scripts/test-moderation-system.ts
```

Tests cover:
- Submit from DRAFT
- Request changes
- Resubmit after changes
- Approve
- Reject
- Error handling
- Message requirements

## Database Queries

### Get all pending content
```sql
SELECT * FROM "Place"
WHERE status = 'PENDING'
ORDER BY "updatedAt" ASC;
```

### Get moderation history for a place
```sql
SELECT ml.*, u.email as reviewer_email
FROM "ModerationLog" ml
LEFT JOIN "User" u ON ml."reviewedByUserId" = u.id
WHERE ml."entityType" = 'PLACE'
  AND ml."entityId" = 'place-id'
ORDER BY ml."createdAt" DESC;
```

### Get places needing changes
```sql
SELECT p.*, u.email as owner_email
FROM "Place" p
JOIN "User" u ON p."ownerUserId" = u.id
WHERE p.status = 'NEEDS_CHANGES'
ORDER BY p."updatedAt" DESC;
```

## Future Enhancements

- Email notifications for status changes
- Bulk moderation actions
- Moderation queue filters and sorting
- Moderator performance metrics
- Auto-approval for trusted business owners
- Content quality scoring
- Moderation templates for common issues
