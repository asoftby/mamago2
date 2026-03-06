# Phase 6: Notifications and Inactivity - Quick Reference

## What Was Implemented

Phase 6 added notification records for Place revision moderation outcomes and inactivity tracking support for follow-up.

## New Notification Types

```typescript
PLACE_UPDATE_APPROVED          // Revision approved
PLACE_UPDATE_NEEDS_REVISION    // Revision needs changes
PLACE_UPDATE_REJECTED          // Revision rejected
```

## Notification Messages

### Approved
- Title: "Изменения опубликованы"
- Message: "Изменения для места «{name}» успешно прошли модерацию и опубликованы."

### Needs Revision
- Title: "Требуются правки"
- Message: "Изменения для места «{name}» требуют правок. Откройте публикацию и внесите исправления. {comment}"

### Rejected
- Title: "Изменения отклонены"
- Message: "Изменения для места «{name}» были отклонены. {comment}"

## Integration Points

### Moderation Service
Notifications created after moderation actions:
- `approvePlaceRevision()` → PLACE_UPDATE_APPROVED
- `requestPlaceRevisionChanges()` → PLACE_UPDATE_NEEDS_REVISION
- `rejectPlaceRevision()` → PLACE_UPDATE_REJECTED

### Error Handling
- Notifications created OUTSIDE transaction
- Moderation succeeds even if notification fails
- Errors logged but don't block workflow

## Inactivity Tracking

### Timestamps
- `revisionRequestedAt` - When changes requested
- `revisionResubmittedAt` - When resubmitted

### Helper Function
```typescript
calculateDaysSinceRevisionRequest(date: Date): number
```

### UI Display
"Отправлено на доработку X дней назад"

## Expired Revisions

### Query Function
```typescript
getExpiredRevisions(daysOld = 30)
```

Returns revisions with:
- status = NEEDS_REVISION
- revisionRequestedAt older than specified days

### Use Cases
- Admin dashboard widget
- Filtered moderation queue
- Automated follow-up
- Business owner reminders

## Future Delivery Channels

Notification records ready for:
1. **Email** - Daily/weekly digests
2. **Telegram** - Instant messages
3. **Push** - Web/mobile notifications
4. **SMS** - Critical alerts
5. **Real-time** - WebSocket updates

## Files Modified

1. `prisma/schema.prisma` - Added types
2. `src/server/services/notification.service.ts` - Added functions
3. `src/server/services/placeRevision.service.ts` - Integrated notifications
4. `src/components/business/notifications/NotificationList.tsx` - Updated UI

## Testing

Verify:
- Notifications created on moderation actions
- Correct title and message
- Links to correct Place
- Shows in notification bell
- Inactivity days calculated correctly
- Expired revisions query works

## Next Phase

Implementation complete! Future work:
- Email delivery system
- Telegram bot
- Push notifications
- SMS integration
