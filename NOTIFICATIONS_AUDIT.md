# Notifications Architecture Audit - Issues Found

## Current Architecture Overview

### Components & Hooks
1. **NotificationsDropdown** (`src/components/site/header/NotificationsDropdown.tsx`)
   - Desktop: Popover with NotificationsPanel
   - Mobile: Modal with NotificationsPanel
   - Has TWO separate implementations: `NotificationsDropdown` (business) and `UserNotificationsDropdown` (user)

2. **NotificationsPanel** (`src/components/business/notifications/NotificationsPanel.tsx`)
   - Container for NotificationFeed + NotificationSettingsInModal
   - Manages panel state (list vs settings)

3. **NotificationFeed** (`src/components/business/notifications/NotificationFeed.tsx`)
   - Fetches and displays notifications
   - Calls mark-open on first open

4. **useUserNotificationBadgeCount** (`src/features/notifications/hooks/useUserNotificationBadgeCount.ts`)
   - Manages badge count for USER stream
   - Uses fallback fetch with `limit=1`
   - Listens to NOTIFICATIONS_CHANGED_EVENT

### API Endpoints
- `GET /api/notifications?limit=15&offset=0` - Fetch notifications list
- `GET /api/notifications?limit=1` - Fetch unread count (PROBLEMATIC)
- `POST /api/notifications/mark-open` - Mark all unseen as seen
- `GET /api/settings/telegram/status` - Check telegram connection (in settings)

---

## Issues Found

### Issue 1: Duplicate Badge Count Fetches
**Location**: NotificationsDropdown.tsx (business stream)
- Line 46-54: `fetchUnreadCount()` uses `limit=1` to get count
- Line 60-66: Fetches on mount
- Line 68-76: Listens to NOTIFICATIONS_CHANGED_EVENT
- Line 78-82: **Fetches AGAIN when panel opens** (`useEffect` on `open`)

**Problem**: 
- When opening business notifications, it fetches count 3 times:
  1. On mount
  2. On NOTIFICATIONS_CHANGED_EVENT
  3. When `open` changes to true

**Impact**: Extra network requests, especially on repeated open/close

### Issue 2: Separate Badge Count Logic for User vs Business
**Location**: NotificationsDropdown.tsx
- Business stream: Uses local `fetchUnreadCount()` with `limit=1`
- User stream: Uses `useUserNotificationBadgeCount()` hook

**Problem**:
- Two different implementations of the same thing
- User stream also calls `refreshUnreadCount()` when panel opens (line 213-215)
- Inconsistent behavior between streams

### Issue 3: mark-open Called Every Time Panel Opens
**Location**: NotificationFeed.tsx
- Line 130-131: `bootstrap()` calls `fetchPage()` then `runMarkOpenAndSync()`
- Line 138-140: `useEffect` on `open` calls `bootstrap()`
- Line 142-147: `useEffect` on NOTIFICATIONS_CHANGED_EVENT calls `bootstrap()`

**Problem**:
- `mark-open` is called every time panel opens, even if:
  - No new unread notifications exist
  - User just closed and reopened panel
  - Notifications were already marked as seen

**Impact**: Unnecessary POST requests, badge doesn't update immediately

### Issue 4: No Caching of Notification List
**Location**: NotificationFeed.tsx
- Line 60-95: `fetchPage()` always makes fresh request
- No caching between open/close cycles
- No deduplication of in-flight requests

**Problem**:
- Opening panel → fetches list
- Closing panel → state is lost
- Opening again → fetches list again (even if nothing changed)

**Impact**: Slow UX, extra network traffic

### Issue 5: Telegram Status Fetched in Settings
**Location**: NotificationSettingsInModal.tsx (not shown but referenced)
- Likely fetches telegram status on every settings open
- No caching

**Problem**:
- Settings panel opens → fetches telegram status
- User closes settings → state lost
- Opens settings again → fetches again

### Issue 6: Email Verification Prompt Fetched Separately
**Location**: NotificationFeed.tsx + useEmailVerificationPromptVisibility
- Email verification status checked independently
- May trigger separate requests

### Issue 7: Double Mount in StrictMode
**Location**: All components
- React 18 StrictMode causes double mount in development
- Each hook runs twice, causing duplicate requests

**Problem**:
- In dev, opening notifications triggers 2x requests
- Confusing for debugging

### Issue 8: No Deduplication of In-Flight Requests
**Location**: useUserNotificationBadgeCount.ts
- Line 24: `inFlightRef` prevents concurrent requests
- But NotificationFeed has no such protection
- Multiple components can trigger fetches simultaneously

---

## Request Flow Analysis

### Current Flow When Opening Notifications (Business)
1. User clicks bell icon
2. `NotificationsDropdown` state changes to `open=true`
3. `useEffect` on `open` triggers `fetchUnreadCount()` → **Request 1: GET /api/notifications?limit=1**
4. `NotificationsMenuContent` renders `NotificationsPanel`
5. `NotificationsPanel` renders `NotificationFeed`
6. `NotificationFeed` `useEffect` on `open` triggers `bootstrap()`
7. `bootstrap()` calls `fetchPage(0, false)` → **Request 2: GET /api/notifications?limit=15&offset=0**
8. `bootstrap()` calls `runMarkOpenAndSync()` → **Request 3: POST /api/notifications/mark-open**
9. `mark-open` response includes `showTelegramPrompt`
10. If settings panel opened: → **Request 4: GET /api/settings/telegram/status** (or similar)

**Total: 3-4 requests per open**

### Current Flow When Closing and Reopening
1. User closes panel
2. State is cleared (notifications array, etc.)
3. User opens panel again
4. **Repeat all steps above** → 3-4 more requests

---

## Solutions

### Solution 1: Unified Badge Count Endpoint
Create a lightweight endpoint:
```
GET /api/notifications/unread-count
```
Returns: `{ unreadCount: number }`

Benefits:
- Lighter than `limit=1` (no notification objects)
- Clear intent
- Can be cached more aggressively

### Solution 2: Consolidate Badge Count Logic
- Remove `fetchUnreadCount()` from NotificationsDropdown (business)
- Use `useUserNotificationBadgeCount()` for both streams
- Pass `stream` parameter to hook

### Solution 3: Cache Notification List
- Store notifications in React Context or state
- Only fetch on first open
- Provide manual refresh button
- Update cache when mark-open succeeds

### Solution 4: Smart mark-open
- Only call if `unreadCount > 0`
- Track `lastMarkedAt` to prevent duplicate calls
- Update badge immediately after success
- Don't refetch full list

### Solution 5: Lazy Load Settings
- Don't fetch telegram status until settings panel opens
- Cache status in context
- Only refresh if user explicitly connects/disconnects

### Solution 6: Deduplicate Requests
- Use `AbortController` to cancel in-flight requests
- Implement request deduplication at hook level
- Prevent concurrent identical requests

### Solution 7: Handle StrictMode
- Use `useRef` to track if already initialized
- Skip duplicate initialization in dev mode

---

## Implementation Plan

1. **Create unified badge count hook** - `useNotificationBadgeCount(stream)`
2. **Create notification list cache** - Context or custom hook
3. **Fix mark-open logic** - Only call when needed
4. **Consolidate NotificationsDropdown** - Single implementation
5. **Add request deduplication** - Prevent concurrent requests
6. **Lazy load settings** - Fetch on demand
7. **Add manual refresh** - User can refresh if needed
8. **Test all flows** - Verify no duplicate requests

---

## Expected Results After Fix

### First Open
- 1 request: GET /api/notifications?limit=15&offset=0
- 1 request: POST /api/notifications/mark-open (if unread > 0)
- Total: 1-2 requests

### Close and Reopen
- 0 requests (use cached list)
- Total: 0 requests

### Open Settings
- 1 request: GET /api/settings/telegram/status (first time only)
- Total: 1 request

### Refresh Button Click
- 1 request: GET /api/notifications?limit=15&offset=0
- Total: 1 request

---

## Files to Modify

1. `src/features/notifications/hooks/useUserNotificationBadgeCount.ts` - Consolidate logic
2. `src/components/site/header/NotificationsDropdown.tsx` - Remove duplicate fetches
3. `src/components/business/notifications/NotificationFeed.tsx` - Add caching, smart mark-open
4. `src/components/business/notifications/NotificationsPanel.tsx` - Pass cache context
5. Create: `src/features/notifications/context/NotificationCacheContext.tsx` - Cache provider
6. Create: `src/features/notifications/hooks/useNotificationCache.ts` - Cache hook
7. Create: `src/app/api/notifications/unread-count/route.ts` - New lightweight endpoint

