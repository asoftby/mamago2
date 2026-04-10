# Place Approval Notifications

## Status: ✅ COMPLETE (Backend + UI)

## Overview

Implemented complete in-app notification system that creates notifications when Places are moderated (approved, needs changes, or rejected). This includes both backend notification creation and full UI for displaying and managing notifications.

**UI Implementation:** See `PLACE_NOTIFICATION_UI.md` for complete UI documentation.

## Database Schema

### Notification Model

```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  message   String
  
  // Entity reference (polymorphic)
  entityType String? // PLACE, ACTIVITY, etc.
  entityId   String?
  
  // Delivery status
  isRead    Boolean  @default(false)
  readAt    DateTime?
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  
  @@index([userId, isRead, createdAt])
  @@index([entityType, entityId])
}
```

### NotificationType Enum

```prisma
enum NotificationType {
  PLACE_APPROVED
  PLACE_NEEDS_CHANGES
  PLACE_REJECTED
  ACTIVITY_APPROVED
  ACTIVITY_NEEDS_CHANGES
  ACTIVITY_REJECTED
  SYSTEM
}
```

### Migration

Created migration: `20260306100330_add_notification_system`

## Notification Triggers

### PLACE_APPROVED

**Trigger:** When moderator changes Place.status from PENDING to PUBLISHED

**Notification:**
```typescript
{
  type: "PLACE_APPROVED",
  title: "Место опубликовано",
  message: "Ваше место «{placeName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.",
  entityType: "PLACE",
  entityId: placeId
}
```

### PLACE_NEEDS_CHANGES

**Trigger:** When moderator changes Place.status from PENDING to NEEDS_CHANGES

**Notification:**
```typescript
{
  type: "PLACE_NEEDS_CHANGES",
  title: "Требуются правки",
  message: "Ваше место «{placeName}» требует доработки. {moderatorComment}",
  entityType: "PLACE",
  entityId: placeId
}
```

### PLACE_REJECTED

**Trigger:** When moderator changes Place.status from PENDING to REJECTED

**Notification:**
```typescript
{
  type: "PLACE_REJECTED",
  title: "Место отклонено",
  message: "Ваше место «{placeName}» было отклонено. {moderatorComment}",
  entityType: "PLACE",
  entityId: placeId
}
```

## Notification Service

**File:** `src/server/services/notification.service.ts`

### Core Functions

**createNotification(params)**
- Creates a notification record
- Parameters: userId, type, title, message, entityType, entityId

**notifyPlaceApproved(placeId, placeName, ownerId)**
- Creates PLACE_APPROVED notification
- Called when place is approved

**notifyPlaceNeedsChanges(placeId, placeName, ownerId, moderatorComment)**
- Creates PLACE_NEEDS_CHANGES notification
- Includes moderator comment in message

**notifyPlaceRejected(placeId, placeName, ownerId, moderatorComment)**
- Creates PLACE_REJECTED notification
- Includes moderator comment in message

### Query Functions

**getUnreadNotifications(userId)**
- Returns all unread notifications for user
- Ordered by createdAt DESC

**getUserNotifications(userId, limit, offset)**
- Returns paginated notifications
- Default limit: 50

**getUnreadCount(userId)**
- Returns count of unread notifications
- Used for badge display

**markNotificationAsRead(notificationId, userId)**
- Marks single notification as read
- Sets readAt timestamp

**markAllNotificationsAsRead(userId)**
- Marks all user's notifications as read

**deleteOldNotifications(daysOld)**
- Cleanup function for old read notifications
- Default: 90 days

## API Endpoints

### GET /api/notifications

Get user's notifications

**Query Parameters:**
- `unreadOnly`: boolean (default: false)
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "notifications": [
    {
      "id": "...",
      "type": "PLACE_APPROVED",
      "title": "Место опубликовано",
      "message": "Ваше место «Test Cafe» успешно прошло модерацию...",
      "entityType": "PLACE",
      "entityId": "...",
      "isRead": false,
      "createdAt": "2024-03-06T10:00:00Z"
    }
  ],
  "unreadCount": 3
}
```

### POST /api/notifications/[id]/read

Mark notification as read

**Response:**
```json
{
  "notification": {
    "id": "...",
    "isRead": true,
    "readAt": "2024-03-06T10:05:00Z"
  }
}
```

## Admin Moderation Integration

**File:** `src/app/api/admin/moderation/places/[id]/route.ts`

Updated to create notifications after moderation actions:

```typescript
// After transaction completes
try {
  if (action === "APPROVE") {
    await notifyPlaceApproved(id, place.title, place.ownerUserId);
  } else if (action === "NEEDS_CHANGES" && comment) {
    await notifyPlaceNeedsChanges(id, place.title, place.ownerUserId, comment);
  } else if (action === "REJECT" && comment) {
    await notifyPlaceRejected(id, place.title, place.ownerUserId, comment);
  }
} catch (notificationError) {
  // Log but don't fail the request if notification fails
  console.error("Failed to create notification:", notificationError);
}
```

**Important:** Notification creation is outside the transaction for resilience. If notification fails, the moderation action still succeeds.

## Testing

### Test Script

**File:** `scripts/manual-tests/test-notification-system.ts`

Tests all notification types and operations:
1. Create PLACE_APPROVED notification ✅
2. Get unread notifications ✅
3. Get unread count ✅
4. Mark notification as read ✅
5. Create PLACE_NEEDS_CHANGES notification ✅
6. Create PLACE_REJECTED notification ✅
7. Get all notifications ✅

**Run tests:**
```bash
npx tsx scripts/manual-tests/test-notification-system.ts
```

### Manual Testing

1. **Create and approve a place:**
   - Business creates place
   - Admin approves it
   - Check notification created for business owner

2. **Request changes:**
   - Admin requests changes with comment
   - Check notification includes moderator comment

3. **Reject place:**
   - Admin rejects with comment
   - Check notification includes rejection reason

4. **API testing:**
   ```bash
   # Get notifications
   curl http://localhost:3002/api/notifications
   
   # Get unread only
   curl http://localhost:3002/api/notifications?unreadOnly=true
   
   # Mark as read
   curl -X POST http://localhost:3002/api/notifications/{id}/read
   ```

## Future Delivery Channels (Not Implemented)

The notification system is designed to support multiple delivery channels:

### Email Notifications
- Send email when notification is created
- Template system for different notification types
- Unsubscribe functionality

### Telegram Notifications
- Bot integration
- User links Telegram account
- Instant delivery

### Push Notifications
- Web push (PWA)
- Mobile push (iOS/Android)
- Service worker integration

### Implementation Pattern
```typescript
// Future: Add delivery channels
async function deliverNotification(notification: Notification) {
  // In-app (already done)
  await createNotification(notification);
  
  // Email (future)
  if (user.emailNotificationsEnabled) {
    await sendEmail(notification);
  }
  
  // Telegram (future)
  if (user.telegramChatId) {
    await sendTelegram(notification);
  }
  
  // Push (future)
  if (user.pushSubscription) {
    await sendPush(notification);
  }
}
```

## Database Indexes

Optimized for common queries:

1. `[userId, isRead, createdAt]` - Get user's unread notifications
2. `[entityType, entityId]` - Find notifications for specific entity

## Cleanup Strategy

**Automatic cleanup job (future):**
```typescript
// Run daily
await deleteOldNotifications(90); // Delete read notifications older than 90 days
```

Keeps database size manageable while preserving recent history.

## Files Created

### Database
1. `prisma/schema.prisma` - Added Notification model and NotificationType enum
2. `prisma/migrations/20260306100330_add_notification_system/` - Migration

### Services
3. `src/server/services/notification.service.ts` - Notification service

### API
4. `src/app/api/notifications/route.ts` - Get notifications
5. `src/app/api/notifications/[id]/read/route.ts` - Mark as read

### Tests
6. `scripts/manual-tests/test-notification-system.ts` - Test script

### Modified
7. `src/app/api/admin/moderation/places/[id]/route.ts` - Create notifications on moderation

## Important Notes

1. **Resilience:** Notification creation is outside the transaction. If it fails, moderation still succeeds.

2. **Polymorphic Design:** entityType/entityId allows notifications for any entity (Place, Activity, etc.).

3. **Extensibility:** Easy to add new notification types to the enum.

4. **Performance:** Indexes optimize common queries (unread notifications, entity lookups).

5. **Privacy:** Users can only access their own notifications (enforced in API).

6. **Cleanup:** Old read notifications can be safely deleted to manage database size.

## Related Documentation

- **Notification UI:** `docs/ai-reports/place/PLACE_NOTIFICATION_UI.md` (UI components and user experience)
- Moderation system: `docs/ai-reports/place/PLACE_MODERATION_IMPLEMENTATION.md`
- Moderation improvements: `docs/ai-reports/place/PLACE_MODERATION_IMPROVEMENTS.md`
- Notification service: `src/server/services/notification.service.ts`
