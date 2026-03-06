# Phase 6: Notification Records and Inactivity Support - COMPLETE

## Status: ✅ COMPLETE

## Overview

Phase 6 successfully implemented notification records for Place revision moderation outcomes and inactivity tracking support. The system creates internal notification records that can be consumed by future delivery channels (email, Telegram, push notifications).

## Implementation Summary

### 1. New Notification Types

**Added to Prisma Schema:**
```prisma
enum NotificationType {
  PLACE_APPROVED
  PLACE_NEEDS_CHANGES
  PLACE_REJECTED
  PLACE_UPDATE_APPROVED          // NEW
  PLACE_UPDATE_NEEDS_REVISION    // NEW
  PLACE_UPDATE_REJECTED          // NEW
  ACTIVITY_APPROVED
  ACTIVITY_NEEDS_CHANGES
  ACTIVITY_REJECTED
  SYSTEM
}
```

**Migration:** `20260306111644_add_place_update_notification_types`

### 2. Notification Functions

**File:** `src/server/services/notification.service.ts`

**New Functions:**

#### A) Place Update Approved
```typescript
export async function notifyPlaceUpdateApproved(
  placeId: string,
  placeName: string,
  ownerId: string
)
```

**Notification:**
- Type: `PLACE_UPDATE_APPROVED`
- Title: "Изменения опубликованы"
- Message: "Изменения для места «{placeName}» успешно прошли модерацию и опубликованы."

#### B) Place Update Needs Revision
```typescript
export async function notifyPlaceUpdateNeedsRevision(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string
)
```

**Notification:**
- Type: `PLACE_UPDATE_NEEDS_REVISION`
- Title: "Требуются правки"
- Message: "Изменения для места «{placeName}» требуют правок. Откройте публикацию и внесите исправления. {moderatorComment}"

#### C) Place Update Rejected
```typescript
export async function notifyPlaceUpdateRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string
)
```

**Notification:**
- Type: `PLACE_UPDATE_REJECTED`
- Title: "Изменения отклонены"
- Message: "Изменения для места «{placeName}» были отклонены. {moderatorComment}"

### 3. Notification Integration

**File:** `src/server/services/placeRevision.service.ts`

**Updated Functions:**

#### approvePlaceRevision
```typescript
// After transaction completes
try {
  await notifyPlaceUpdateApproved(
    revision.placeId,
    revision.title,
    revision.place.ownerUserId
  );
} catch (notificationError) {
  console.error("Failed to create notification:", notificationError);
  // Don't fail the approval if notification fails
}
```

#### requestPlaceRevisionChanges
```typescript
// After transaction completes
const place = await prisma.place.findUnique({
  where: { id: revision.placeId },
  select: { title: true, ownerUserId: true },
});

if (place) {
  try {
    await notifyPlaceUpdateNeedsRevision(
      revision.placeId,
      revision.title,
      place.ownerUserId,
      comment
    );
  } catch (notificationError) {
    console.error("Failed to create notification:", notificationError);
  }
}
```

#### rejectPlaceRevision
```typescript
// After transaction completes
const place = await prisma.place.findUnique({
  where: { id: revision.placeId },
  select: { title: true, ownerUserId: true },
});

if (place) {
  try {
    await notifyPlaceUpdateRejected(
      revision.placeId,
      revision.title,
      place.ownerUserId,
      comment
    );
  } catch (notificationError) {
    console.error("Failed to create notification:", notificationError);
  }
}
```

**Key Design Decision:**
- Notifications created OUTSIDE transaction for resilience
- Moderation action succeeds even if notification fails
- Errors logged but don't block the workflow

### 4. Inactivity Tracking

**Timestamp Fields Used:**
- `revisionRequestedAt` - When admin requested changes
- `revisionResubmittedAt` - When business resubmitted after changes

**Helper Function:**
```typescript
export function calculateDaysSinceRevisionRequest(
  revisionRequestedAt: Date
): number {
  const now = new Date();
  const diffMs = now.getTime() - revisionRequestedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
```

**Business UI Display:**
Already implemented in Phase 4:
- PlaceCardHorizontal shows: "Отправлено на доработку X дней назад"
- PlaceWizard shows days in yellow banner
- Calculation done in frontend using revisionRequestedAt

### 5. Expired Revisions Filtering

**File:** `src/server/services/placeRevision.service.ts`

**New Function:**
```typescript
export async function getExpiredRevisions(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return prisma.placeRevision.findMany({
    where: {
      status: "NEEDS_REVISION",
      revisionRequestedAt: {
        lt: cutoffDate,
      },
    },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          city: { select: { name: true } },
          owner: {
            select: {
              id: true,
              email: true,
              business: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: {
      revisionRequestedAt: "asc",
    },
  });
}
```

**Usage:**
```typescript
// Get revisions older than 30 days
const expired = await getExpiredRevisions(30);

// Get revisions older than 7 days
const weekOld = await getExpiredRevisions(7);
```

**Admin UI Integration:**
Can be used to create:
- Admin dashboard widget showing expired count
- Filtered view in moderation queue
- Automated follow-up system
- Business owner reminders

### 6. Notification UI Updates

**File:** `src/components/business/notifications/NotificationList.tsx`

**Updated Icon Mapping:**
```typescript
const getNotificationIcon = (type: string): string => {
  switch (type) {
    case "PLACE_APPROVED":
      return "✅";
    case "PLACE_NEEDS_CHANGES":
      return "⚠️";
    case "PLACE_REJECTED":
      return "❌";
    case "PLACE_UPDATE_APPROVED":      // NEW
      return "✅";
    case "PLACE_UPDATE_NEEDS_REVISION": // NEW
      return "⚠️";
    case "PLACE_UPDATE_REJECTED":       // NEW
      return "❌";
    default:
      return "📢";
  }
};
```

**Link Handling:**
All Place-related notifications link to:
```typescript
`/business/places/${notification.entityId}/edit`
```

This works for both initial Places and revisions since the edit page automatically detects revision mode.

## Notification Flow

### Initial Place Moderation

```
Place submitted (DRAFT → PENDING)
    ↓
Admin reviews
    ├─ APPROVE → PLACE_APPROVED notification
    ├─ NEEDS_REVISION → PLACE_NEEDS_CHANGES notification
    └─ REJECT → PLACE_REJECTED notification
```

### Place Revision Moderation

```
Revision submitted (DRAFT → PENDING)
    ↓
Admin reviews
    ├─ APPROVE → PLACE_UPDATE_APPROVED notification
    ├─ NEEDS_REVISION → PLACE_UPDATE_NEEDS_REVISION notification
    └─ REJECT → PLACE_UPDATE_REJECTED notification
```

## Inactivity Tracking Flow

```
Admin requests changes
    ↓
revisionRequestedAt = now()
    ↓
Business sees: "Отправлено на доработку X дней назад"
    ↓
Business edits and resubmits
    ↓
revisionResubmittedAt = now()
status = PENDING
    ↓
Admin reviews again
```

## Future Delivery Channels

The notification records created in this phase can be consumed by:

### 1. Email Notifications
**Implementation:**
- Background job queries unread notifications
- Sends email digest (daily/weekly)
- Marks as sent in separate tracking table
- Uses notification.title and notification.message
- Links to entityId for direct access

**Example:**
```typescript
async function sendEmailDigest(userId: string) {
  const notifications = await getUnreadNotifications(userId);
  const user = await getUserWithEmail(userId);
  
  await sendEmail({
    to: user.email,
    subject: `У вас ${notifications.length} новых уведомлений`,
    body: renderEmailTemplate(notifications),
  });
}
```

### 2. Telegram Bot
**Implementation:**
- User links Telegram account to mamaGo profile
- Webhook receives notification events
- Sends instant message via Telegram API
- Includes inline buttons for quick actions

**Example:**
```typescript
async function sendTelegramNotification(
  userId: string,
  notification: Notification
) {
  const telegramId = await getTelegramId(userId);
  
  await bot.sendMessage(telegramId, {
    text: `${notification.title}\n\n${notification.message}`,
    reply_markup: {
      inline_keyboard: [[
        { text: "Открыть", url: getNotificationUrl(notification) }
      ]]
    }
  });
}
```

### 3. Push Notifications (Web/Mobile)
**Implementation:**
- Service worker for web push
- FCM for mobile apps
- Subscribe to notification topics
- Show native OS notifications

**Example:**
```typescript
async function sendPushNotification(
  userId: string,
  notification: Notification
) {
  const subscription = await getPushSubscription(userId);
  
  await webpush.sendNotification(subscription, {
    title: notification.title,
    body: notification.message,
    icon: "/icon.png",
    data: {
      url: getNotificationUrl(notification),
    },
  });
}
```

### 4. SMS Notifications
**Implementation:**
- For critical notifications only
- Uses existing SMS service
- Short message with link

**Example:**
```typescript
async function sendSMSNotification(
  userId: string,
  notification: Notification
) {
  const phone = await getUserPhone(userId);
  
  await sendSMS({
    to: phone,
    message: `${notification.title}. Подробнее: ${getShortUrl(notification)}`,
  });
}
```

### 5. In-App Real-time Updates
**Implementation:**
- WebSocket connection
- Server-Sent Events (SSE)
- Polling fallback
- Updates notification bell in real-time

**Example:**
```typescript
// Server
io.to(`user:${userId}`).emit("notification", notification);

// Client
socket.on("notification", (notification) => {
  showToast(notification.title);
  updateNotificationBell();
});
```

## Database Schema

**Notification Model:**
```prisma
model Notification {
  id         String           @id @default(cuid())
  userId     String
  type       NotificationType
  title      String
  message    String
  
  // Entity reference (polymorphic)
  entityType String? // PLACE, ACTIVITY, etc.
  entityId   String?
  
  // Delivery status
  isRead     Boolean  @default(false)
  readAt     DateTime?
  
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt  DateTime @default(now())
  
  @@index([userId, isRead, createdAt])
  @@index([entityType, entityId])
}
```

**Key Fields for Delivery:**
- `userId` - Target user
- `type` - Notification type for filtering
- `title` - Short heading
- `message` - Full message text
- `entityType` + `entityId` - Link to related entity
- `isRead` - Delivery tracking
- `createdAt` - Timestamp for ordering

## Files Created

1. `prisma/migrations/20260306111644_add_place_update_notification_types/` - Migration
2. `docs/ai-reports/place/PHASE6_NOTIFICATIONS_COMPLETE.md` - This document

## Files Modified

3. `prisma/schema.prisma` - Added notification types
4. `src/server/services/notification.service.ts` - Added 3 new functions
5. `src/server/services/placeRevision.service.ts` - Integrated notifications, added helpers
6. `src/components/business/notifications/NotificationList.tsx` - Updated icon mapping

## Testing Checklist

### Notification Creation

- [ ] Approve revision → PLACE_UPDATE_APPROVED created
- [ ] Request changes → PLACE_UPDATE_NEEDS_REVISION created
- [ ] Reject revision → PLACE_UPDATE_REJECTED created
- [ ] Notification has correct title
- [ ] Notification has correct message
- [ ] Notification links to correct Place
- [ ] Notification shows in bell dropdown
- [ ] Notification shows on notifications page

### Inactivity Tracking

- [ ] revisionRequestedAt set when changes requested
- [ ] Days calculation correct
- [ ] Business UI shows "X дней назад"
- [ ] revisionResubmittedAt set on resubmit
- [ ] Timestamps persist correctly

### Expired Revisions

- [ ] getExpiredRevisions returns correct results
- [ ] Default 30 days works
- [ ] Custom days parameter works
- [ ] Includes Place and owner data
- [ ] Sorted by oldest first

### Error Handling

- [ ] Moderation succeeds if notification fails
- [ ] Error logged to console
- [ ] Transaction not rolled back
- [ ] User experience not affected

## Performance Considerations

**Notification Creation:**
- Outside transaction (non-blocking)
- Single INSERT query
- Indexed on userId and createdAt
- Fast lookup for unread count

**Expired Revisions Query:**
- Indexed on status and revisionRequestedAt
- Efficient date comparison
- Includes only necessary fields
- Can be cached/materialized

**Delivery Channels:**
- Background jobs (not blocking requests)
- Batch processing for email digests
- Rate limiting for SMS
- Queue-based for reliability

## Success Criteria

- [x] New notification types added to schema
- [x] Migration applied successfully
- [x] Notification functions created
- [x] Notifications integrated into moderation flow
- [x] Notifications created outside transaction
- [x] Error handling implemented
- [x] Inactivity helper functions added
- [x] Expired revisions query implemented
- [x] Notification UI updated
- [x] Documentation complete
- [ ] Manual testing complete
- [ ] Future delivery channels documented

## Related Documentation

- Phase 1: `PHASE1_SCHEMA_FOUNDATION_COMPLETE.md`
- Phase 2: `PHASE2_SERVICE_LAYER_COMPLETE.md`
- Phase 3: `PHASE3_API_LAYER_COMPLETE.md`
- Phase 4: `PHASE4_BUSINESS_UI_COMPLETE.md`
- Phase 5: `PHASE5_ADMIN_UI_COMPLETE.md`
- Architecture: `PLACE_REVISION_ARCHITECTURE.md`
- Existing Notifications: `PLACE_NOTIFICATION_UI.md`

## Next Steps

### Immediate
- Manual testing of notification creation
- Verify inactivity calculations
- Test expired revisions query

### Future Enhancements
- Email notification delivery
- Telegram bot integration
- Push notification support
- SMS for critical notifications
- Real-time WebSocket updates
- Notification preferences UI
- Delivery tracking and analytics
