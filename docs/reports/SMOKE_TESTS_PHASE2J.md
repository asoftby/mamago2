# Smoke Tests — Notification System Phase 2J

**Date**: May 12, 2026  
**Scope**: Manual smoke tests for production readiness

---

## Pre-Test Setup

### Prerequisites

- [ ] Development environment running (`pnpm dev`)
- [ ] Database seeded with test data
- [ ] Telegram DEV bot connected (optional, for Telegram tests)
- [ ] Test user account created
- [ ] Test business account created

### Test Accounts

**Test User**:
- Email: `test-user@example.com`
- Password: `test123`
- Role: USER

**Test Business**:
- Email: `test-business@example.com`
- Password: `test123`
- Role: BUSINESS_OWNER
- Name: "Test Business"

---

## Test 1: Telegram Connection

### Objective

Verify that users can connect Telegram and receive test notifications.

### Steps

1. **Login as test user**
   - Navigate to `/me/settings` or notification settings
   - Verify "Telegram" section is visible

2. **Click "Подключить" (Connect)**
   - Button should open Telegram bot link
   - Bot should be `@mamago_dev_bot` (or configured bot)

3. **Send `/start` to bot**
   - Bot should send confirmation message
   - Message should include user ID or confirmation code

4. **Verify connection status**
   - Return to settings
   - Status should show "Подключён" (Connected)
   - Username should be displayed

5. **Send test notification**
   - Click "Отправить тест" (Send Test)
   - Test message should appear in Telegram
   - Response should be `{ ok: true }`

### Expected Results

- ✅ Telegram connection successful
- ✅ Test notification received
- ✅ Status shows "Подключён"
- ✅ No errors in console

### Failure Scenarios

- ❌ Bot link doesn't open → Check `TELEGRAM_BOT_USERNAME_DEV`
- ❌ Test notification fails → Check `TELEGRAM_BOT_TOKEN_DEV`
- ❌ Status doesn't update → Check database connection

---

## Test 2: Booking Creation Notification

### Objective

Verify that business receives notification when user creates booking.

### Steps

1. **Login as test user**
   - Navigate to discovery page
   - Find a test activity/place/offer

2. **Create booking**
   - Click "Записаться" or similar
   - Fill in booking details
   - Submit booking

3. **Verify business receives notification**
   - Login as test business
   - Check notification center
   - Should see "Новая заявка" (New booking)
   - Should show customer name and activity title

4. **Verify in-app notification**
   - Notification should appear in `/business/notifications`
   - Status should be "Новое" (New)
   - Should have CTA "Открыть заявки"

5. **Verify Telegram notification (if connected)**
   - Check Telegram
   - Should receive booking notification
   - Should include customer name and activity title

### Expected Results

- ✅ In-app notification created
- ✅ Notification appears in center
- ✅ Telegram notification sent (if connected)
- ✅ CTA button works

### Failure Scenarios

- ❌ Notification not created → Check `notifyBookingCreated()` trigger
- ❌ Telegram not sent → Check Telegram connection
- ❌ CTA doesn't work → Check routing

---

## Test 3: Booking Confirmation Notification

### Objective

Verify that user receives notification when business confirms booking.

### Steps

1. **Create booking (from Test 2)**
   - User creates booking
   - Business receives notification

2. **Login as test business**
   - Navigate to `/business/bookings`
   - Find the test booking
   - Status should be "NEW"

3. **Confirm booking**
   - Click booking
   - Change status to "CONFIRMED"
   - Save

4. **Verify user receives notification**
   - Login as test user
   - Check notification center
   - Should see "Заявка подтверждена" (Booking confirmed)
   - Should show activity title

5. **Verify in `/me/bookings`**
   - Navigate to `/me/bookings`
   - Booking should appear in "ACTIVE" section
   - Status should show "CONFIRMED"
   - Should have CTA "Открыть" (Open)

6. **Verify Telegram notification (if connected)**
   - Check Telegram
   - Should receive confirmation notification

### Expected Results

- ✅ User receives notification
- ✅ Notification appears in center
- ✅ Booking appears in `/me/bookings`
- ✅ Telegram notification sent (if connected)

### Failure Scenarios

- ❌ Notification not created → Check `notifyUserBookingConfirmed()` trigger
- ❌ Booking not in `/me/bookings` → Check booking query
- ❌ Dedup triggered → Check dedup logic

---

## Test 4: Booking Completion and Feedback Request

### Objective

Verify that user receives feedback request after booking completion.

### Steps

1. **Confirm booking (from Test 3)**
   - Business confirms booking
   - User receives notification

2. **Complete booking**
   - Login as test business
   - Navigate to `/business/bookings`
   - Find confirmed booking
   - Change status to "COMPLETED"
   - Save

3. **Verify user receives notifications**
   - Login as test user
   - Check notification center
   - Should see "Заявка завершена" (Booking completed)
   - Should see "Как прошло?" (How did it go?) - feedback request

4. **Verify in `/me/bookings`**
   - Navigate to `/me/bookings`
   - Booking should appear in "COMPLETED" section
   - Should show feedback widget or CTA

5. **Submit feedback (if available)**
   - Click "Оставить отзыв" (Leave feedback)
   - Rate 1-5 stars
   - Add optional comment
   - Submit

### Expected Results

- ✅ Completion notification received
- ✅ Feedback request notification received
- ✅ Booking appears in COMPLETED section
- ✅ Feedback can be submitted

### Failure Scenarios

- ❌ Notifications not created → Check triggers
- ❌ Booking not in COMPLETED → Check status update
- ❌ Feedback widget not shown → Check `/me/bookings` implementation

---

## Test 5: Stale Booking Detection

### Objective

Verify that stale booking job detects and notifies about old bookings.

### Steps

1. **Create old booking**
   - Create booking in NEW status
   - Manually set `createdAt` to 24+ hours ago (in database)
   - Or wait 24+ hours

2. **Run stale booking job**
   - Execute: `await runBookingStaleNotificationJob()`
   - Or wait for scheduled job to run

3. **Verify notification created**
   - Login as test business
   - Check notification center
   - Should see "Заявка ждёт ответа" (Booking waiting for response)
   - Should show customer name and hours/days

4. **Verify deduplication**
   - Run job again
   - No duplicate notification should be created
   - Should skip due to dedup

5. **Verify for CONFIRMED bookings**
   - Create CONFIRMED booking
   - Set `lastActivityAt` to 72+ hours ago
   - Run job
   - Should see "Требует внимания" (Needs attention)

### Expected Results

- ✅ Stale notification created
- ✅ Deduplication works (no duplicates)
- ✅ Both STALE and NEEDS_ATTENTION types work
- ✅ Correct messaging

### Failure Scenarios

- ❌ Notification not created → Check job logic
- ❌ Duplicate created → Check dedup
- ❌ Wrong message → Check body builder

---

## Test 6: Retry Logic

### Objective

Verify that failed deliveries are retried with exponential backoff.

### Steps

1. **Simulate failed delivery**
   - Create notification
   - Manually set delivery status to "FAILED"
   - Set error message to transient error (e.g., "ECONNREFUSED")

2. **Run retry job**
   - Execute: `await retryFailedDelivery(deliveryId)`
   - Should retry with backoff

3. **Verify retry attempt**
   - Check `attemptCount` in database
   - Should be incremented
   - Should be < 3

4. **Verify permanent error not retried**
   - Create failed delivery with permanent error (e.g., "CHANNEL_DISABLED")
   - Run retry job
   - Should not retry
   - `attemptCount` should not change

5. **Verify max attempts**
   - Create failed delivery with `attemptCount = 3`
   - Run retry job
   - Should not retry
   - Should remain FAILED

### Expected Results

- ✅ Transient errors retried
- ✅ Permanent errors not retried
- ✅ Attempt count incremented
- ✅ Max attempts respected

### Failure Scenarios

- ❌ Transient error not retried → Check `isTransientError()`
- ❌ Permanent error retried → Check error classification
- ❌ Attempt count not incremented → Check database update

---

## Test 7: No Duplicates

### Objective

Verify that deduplication prevents duplicate notifications.

### Steps

1. **Create booking**
   - User creates booking
   - Business receives BOOKING_CREATED

2. **Confirm booking**
   - Business confirms booking
   - User receives BOOKING_CONFIRMED

3. **Try to confirm again (shouldn't happen)**
   - Manually call `notifyUserBookingConfirmed()` again
   - Should return `null` (deduplicated)
   - No duplicate notification created

4. **Verify stale dedup**
   - Create old booking
   - Run stale job
   - Notification created
   - Run job again
   - No duplicate (dedup respected)

5. **Verify different types not deduplicated**
   - Create BOOKING_CONFIRMED notification
   - Create BOOKING_COMPLETED notification
   - Both should exist (different types)

### Expected Results

- ✅ Same type deduplicated
- ✅ Different types not deduplicated
- ✅ Dedup window respected (24h for reminders)

### Failure Scenarios

- ❌ Duplicate created → Check dedup logic
- ❌ Different types deduplicated → Check type checking

---

## Test 8: API Request Hygiene

### Objective

Verify that API requests are optimized and don't spam.

### Steps

1. **Open notification dropdown**
   - Open notification center
   - Check network tab
   - Should see minimal requests

2. **Verify unread-count is lightweight**
   - Check request payload
   - Should be small (count only, not full list)
   - Response time < 100ms

3. **Verify throttling**
   - Open dropdown multiple times rapidly
   - Should not see multiple unread-count requests
   - Should be throttled to 10s minimum

4. **Verify settings modal**
   - Open settings modal
   - Should not poll Telegram status unnecessarily
   - Only check when user clicks "Подключить"

5. **Verify no avalanche**
   - Open dropdown on desktop
   - Open modal on mobile
   - Should not see avalanche of requests
   - Network tab should be clean

### Expected Results

- ✅ Minimal requests
- ✅ Throttling works
- ✅ No avalanche
- ✅ Response times fast

### Failure Scenarios

- ❌ Too many requests → Check throttling
- ❌ Slow response → Check query optimization
- ❌ Avalanche of requests → Check for loops

---

## Test 9: Error Handling

### Objective

Verify that errors don't break the main flow.

### Steps

1. **Disable Telegram**
   - Unset `TELEGRAM_BOT_TOKEN_DEV`
   - Create booking
   - Business should still receive in-app notification
   - Telegram delivery should be SKIPPED

2. **Disable email**
   - Unset `RESEND_API_KEY`
   - Create booking
   - Business should still receive in-app notification
   - Email delivery should be SKIPPED

3. **Simulate network error**
   - Mock network timeout in Telegram send
   - Create booking
   - In-app notification should still be created
   - Telegram delivery should be FAILED
   - Retry job should retry later

4. **Verify logging**
   - Check logs
   - Should see error messages
   - Should not see sensitive data (phone, email)

### Expected Results

- ✅ Main flow continues on error
- ✅ Errors logged appropriately
- ✅ No sensitive data in logs
- ✅ Graceful degradation

### Failure Scenarios

- ❌ Main flow breaks → Check error handling
- ❌ Sensitive data in logs → Check logging
- ❌ No error message → Check logging

---

## Test 10: Delivery Diagnostics

### Objective

Verify that diagnostics functions work correctly.

### Steps

1. **Get delivery stats**
   - Execute: `await getDeliveryStats(userId)`
   - Should return stats by channel
   - Should show sent, failed, skipped, pending counts

2. **Get latest failures**
   - Execute: `await getLatestFailedDeliveries(userId, 5)`
   - Should return array of failed deliveries
   - Should include notification details

3. **Get Telegram failures**
   - Execute: `await getLatestTelegramFailures(5)`
   - Should return Telegram-specific failures
   - Should include error messages

4. **Get email failures**
   - Execute: `await getLatestEmailFailures(5)`
   - Should return email-specific failures
   - Should include error messages

### Expected Results

- ✅ All functions return data
- ✅ Data is accurate
- ✅ No sensitive data exposed

### Failure Scenarios

- ❌ Functions throw errors → Check implementation
- ❌ Data is inaccurate → Check queries
- ❌ Sensitive data exposed → Check filtering

---

## Test Execution Checklist

### Pre-Test

- [ ] Environment variables configured
- [ ] Database seeded
- [ ] Test accounts created
- [ ] Development server running
- [ ] Telegram bot connected (optional)

### Tests

- [ ] Test 1: Telegram Connection
- [ ] Test 2: Booking Creation Notification
- [ ] Test 3: Booking Confirmation Notification
- [ ] Test 4: Booking Completion and Feedback
- [ ] Test 5: Stale Booking Detection
- [ ] Test 6: Retry Logic
- [ ] Test 7: No Duplicates
- [ ] Test 8: API Request Hygiene
- [ ] Test 9: Error Handling
- [ ] Test 10: Delivery Diagnostics

### Post-Test

- [ ] All tests passed
- [ ] No errors in console
- [ ] No sensitive data in logs
- [ ] Performance acceptable
- [ ] Ready for production

---

## Known Issues

### None

All tests should pass in current implementation.

---

## Troubleshooting

### Telegram Tests Fail

- Check `TELEGRAM_BOT_TOKEN_DEV` is set
- Check bot is not blocked
- Check webhook is configured
- Check network connectivity

### Booking Tests Fail

- Check booking creation endpoint works
- Check database connection
- Check notification triggers are connected
- Check user/business accounts exist

### Stale Job Tests Fail

- Check job function is accessible
- Check database has test bookings
- Check dedup logic works
- Check timestamps are correct

### Retry Tests Fail

- Check retry function is accessible
- Check error classification works
- Check database updates work
- Check backoff timing is correct

---

## Summary

**Total Tests**: 10

**Estimated Time**: 30-45 minutes

**Pass Criteria**: All tests pass without errors

**Next Steps**: 
1. Execute all tests
2. Document results
3. Fix any failures
4. Deploy to production
