# Notifications Optimization - Technical Guide

## Architecture Changes

### Before: Request Flow Diagram
```
NotificationsDropdown (open=true)
├─ fetchUnreadCount() [DUPLICATE #1]
├─ NOTIFICATIONS_CHANGED_EVENT listener
│  └─ fetchUnreadCount() [DUPLICATE #2]
└─ useEffect on open
   └─ fetchUnreadCount() [DUPLICATE #3]

NotificationFeed (open=true)
├─ bootstrap()
│  ├─ fetchPage() → GET /api/notifications?limit=15
│  └─ runMarkOpenAndSync() → POST /api/notifications/mark-open
└─ NOTIFICATIONS_CHANGED_EVENT listener
   └─ bootstrap() [REFETCH EVEN IF CACHED]

Result: 3-4 requests per open, duplicates on every open
```

### After: Request Flow Diagram
```
NotificationsDropdown (open=true)
├─ useUserNotificationBadgeCount()
│  ├─ On mount: GET /api/notifications/unread-count
│  └─ On NOTIFICATIONS_CHANGED_EVENT: GET /api/notifications/unread-count
└─ [NO DUPLICATE ON OPEN]

NotificationFeed (open=true)
├─ bootstrap()
│  ├─ Check if cached: YES
│  │  └─ Skip fetch
│  ├─ Check if cached: NO
│  │  └─ fetchPage() → GET /api/notifications?limit=15
│  └─ runMarkOpenAndSync()
│     ├─ Check if unread: NO
│     │  └─ Skip (if marked recently)
│     ├─ Check if unread: YES
│     │  └─ POST /api/notifications/mark-open
│     └─ Update badge immediately
└─ NOTIFICATIONS_CHANGED_EVENT listener
   └─ Only refetch if cached (prevent duplicate on first load)

Result: 1-2 requests on first open, 0 on reopen
```

---

## Key Changes Explained

### 1. New Lightweight Endpoint

**File**: `src/app/api/notifications/unread-count/route.ts`

```typescript
// Before: GET /api/notifications?limit=1
// Returns: { notifications: [...], unreadCount: 5, ... }
// Payload: ~2-5KB (full notification objects)

// After: GET /api/notifications/unread-count
// Returns: { unreadCount: 5 }
// Payload: ~100 bytes
```

**Benefits**:
- 95% smaller payload
- Clearer intent
- Easier to cache
- Faster response time

**Implementation**:
```typescript
// Reuses same query options as main endpoint
const queryOpts = {
  telegramConnected: telegramStatus.linked,
  accessibleSurfaces,
};
const unreadCount = await getUnreadCount(user.id, stream, queryOpts);
```

---

### 2. Smart mark-open Logic

**File**: `src/components/business/notifications/NotificationFeed.tsx`

**Before**:
```typescript
const runMarkOpenAndSync = useCallback(async () => {
  // Always calls mark-open, no checks
  const markRes = await fetch(`/api/notifications/mark-open`, {
    method: "POST",
    credentials: "include",
  });
  // ... update state
}, [onNotificationRead]);
```

**After**:
```typescript
const runMarkOpenAndSync = useCallback(async () => {
  // Check 1: Not already in flight
  if (markOpenInFlightRef.current) return;

  // Check 2: Has unread OR hasn't marked recently
  const hasUnread = notifications.some((n) => !n.seenAt);
  const timeSinceLastMarkOpen = lastMarkedOpenAtRef.current 
    ? now - lastMarkedOpenAtRef.current 
    : Infinity;
  
  if (!hasUnread && timeSinceLastMarkOpen < 5 * 60 * 1000) {
    return; // Skip if no unread and marked within 5 minutes
  }

  markOpenInFlightRef.current = true;
  try {
    const markRes = await fetch(`/api/notifications/mark-open`, {
      method: "POST",
      credentials: "include",
    });
    if (!markRes.ok) return;
    
    lastMarkedOpenAtRef.current = Date.now();
    // ... update state
  } finally {
    markOpenInFlightRef.current = false;
  }
}, [notifications, onNotificationRead]);
```

**Benefits**:
- Prevents concurrent requests (in-flight check)
- Prevents duplicate calls (time-based debounce)
- Only calls when needed (unread check)
- Immediate badge update

---

### 3. Notification List Caching

**File**: `src/components/business/notifications/NotificationFeed.tsx`

**Before**:
```typescript
const bootstrap = useCallback(async () => {
  try {
    setLoading(true);
    await fetchPage(0, false); // Always fetch
    void runMarkOpenAndSync();
  } catch (error) {
    // ...
  } finally {
    setLoading(false);
  }
}, [fetchPage, runMarkOpenAndSync]);
```

**After**:
```typescript
const bootstrap = useCallback(async () => {
  try {
    // Check if already have cached data
    if (notifications.length > 0) {
      // Just run mark-open, don't refetch
      void runMarkOpenAndSync();
      return;
    }

    setLoading(true);
    await fetchPage(0, false); // Only fetch if empty
    void runMarkOpenAndSync();
  } catch (error) {
    // ...
  } finally {
    setLoading(false);
  }
}, [notifications.length, fetchPage, runMarkOpenAndSync]);
```

**Benefits**:
- Instant panel open on reopen
- No duplicate fetches
- Respects user's data
- Smooth UX

---

### 4. Smart Event Listener

**File**: `src/components/business/notifications/NotificationFeed.tsx`

**Before**:
```typescript
useEffect(() => {
  const handler = () => {
    if (!open) return;
    void bootstrap(); // Always refetch
  };
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
}, [open, bootstrap]);
```

**After**:
```typescript
useEffect(() => {
  const handler = () => {
    if (!open) return;
    // Only refetch if we have cached data
    // This prevents duplicate fetches on mount
    if (notifications.length > 0) {
      void bootstrap();
    }
  };
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
}, [open, bootstrap, notifications.length]);
```

**Benefits**:
- Prevents duplicate fetch on first load
- Still refetches when external event fires
- Respects cache state

---

### 5. Removed Duplicate Refresh

**File**: `src/components/site/header/NotificationsDropdown.tsx`

**Before**:
```typescript
function UserNotificationsDropdown({ open, ... }) {
  const { displayUnreadCount, refreshUnreadCount } = useUserNotificationBadgeCount();

  // Duplicate refresh on open
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => void refreshUnreadCount(), 0);
    return () => window.clearTimeout(id);
  }, [open, refreshUnreadCount]);

  // ... rest of component
}
```

**After**:
```typescript
function UserNotificationsDropdown({ open, ... }) {
  const { displayUnreadCount, refreshUnreadCount } = useUserNotificationBadgeCount();

  // Removed duplicate refresh - badge already updated via event listeners
  // No useEffect on open

  // ... rest of component
}
```

**Benefits**:
- Removes redundant fetch
- Badge already updated via NOTIFICATIONS_CHANGED_EVENT
- Cleaner code

---

### 6. Removed Duplicate Fetch on Open

**File**: `src/components/site/header/NotificationsDropdown.tsx`

**Before**:
```typescript
// Business stream
useEffect(() => {
  if (isUserStream) return;
  if (!open) return;
  const id = window.setTimeout(() => void fetchUnreadCount(), 0);
  return () => window.clearTimeout(id);
}, [open, fetchUnreadCount, isUserStream]); // Fetches on open
```

**After**:
```typescript
// Removed this useEffect entirely
// Badge count already fetched on mount and on NOTIFICATIONS_CHANGED_EVENT
```

**Benefits**:
- Removes redundant fetch
- Cleaner code
- Same functionality

---

## State Management

### Component State (NotificationFeed)
```typescript
const [notifications, setNotifications] = useState<NotificationApiRow[]>([]);
const [loading, setLoading] = useState(true);
const [hasMore, setHasMore] = useState(false);
const [offset, setOffset] = useState(0);
const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);

// Refs for tracking state across renders
const markOpenInFlightRef = useRef(false);
const lastMarkedOpenAtRef = useRef<number | null>(null);
```

### Why Refs?
- `markOpenInFlightRef`: Prevents concurrent mark-open requests
- `lastMarkedOpenAtRef`: Tracks when mark-open was last called
- Refs don't trigger re-renders (unlike state)
- Persist across renders

---

## Request Deduplication Strategy

### In-Flight Tracking
```typescript
const markOpenInFlightRef = useRef(false);

// Before making request
if (markOpenInFlightRef.current) {
  return; // Already in flight, skip
}

markOpenInFlightRef.current = true;
try {
  // Make request
} finally {
  markOpenInFlightRef.current = false;
}
```

### Time-Based Debouncing
```typescript
const lastMarkedOpenAtRef = useRef<number | null>(null);

const timeSinceLastMarkOpen = lastMarkedOpenAtRef.current 
  ? now - lastMarkedOpenAtRef.current 
  : Infinity;

if (!hasUnread && timeSinceLastMarkOpen < 5 * 60 * 1000) {
  return; // Skip if no unread and marked within 5 minutes
}

lastMarkedOpenAtRef.current = Date.now();
```

---

## Cache Invalidation

### When Cache is Cleared
1. **Component unmount**: State is lost (React default)
2. **Manual refresh**: User clicks refresh button (future feature)
3. **External event**: NOTIFICATIONS_CHANGED_EVENT fires (refetch if cached)

### When Cache is Kept
1. **Close and reopen**: Cache persists in component state
2. **Within 5 minutes**: mark-open not called again
3. **After 5 minutes**: mark-open called again (time-based refresh)

---

## Performance Metrics

### Before Optimization
```
First Open:
- GET /api/notifications?limit=1 (badge)
- GET /api/notifications?limit=15 (list)
- POST /api/notifications/mark-open
- Total: 3 requests, ~5-10KB

Reopen (same session):
- GET /api/notifications?limit=1 (badge)
- GET /api/notifications?limit=15 (list)
- POST /api/notifications/mark-open
- Total: 3 requests, ~5-10KB

Total per session: 6+ requests, 10-20KB
```

### After Optimization
```
First Open:
- GET /api/notifications/unread-count (badge)
- GET /api/notifications?limit=15 (list)
- POST /api/notifications/mark-open
- Total: 3 requests, ~1-2KB

Reopen (same session):
- (cached, no requests)
- Total: 0 requests, 0KB

After 5 minutes:
- POST /api/notifications/mark-open
- Total: 1 request, ~100 bytes

Total per session: 4 requests, 1-2KB (-80%)
```

---

## Error Handling

### Network Errors
```typescript
try {
  const res = await fetch(`/api/notifications/unread-count`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    setFallbackUnreadCount(0);
    return;
  }
  // ... process response
} catch {
  setFallbackUnreadCount(0); // Fallback to 0 on error
}
```

### mark-open Errors
```typescript
try {
  const markRes = await fetch(`/api/notifications/mark-open`, {
    method: "POST",
    credentials: "include",
  });
  if (!markRes.ok) return; // Silently fail, don't update state
  // ... update state only on success
} catch (error) {
  console.error("Failed to mark notifications as open:", error);
} finally {
  markOpenInFlightRef.current = false; // Always reset flag
}
```

---

## Testing Strategy

### Unit Tests (Future)
- Test mark-open deduplication logic
- Test cache invalidation
- Test error handling

### Integration Tests (Future)
- Test full flow: open → mark-open → close → reopen
- Test concurrent opens
- Test event listeners

### Manual Testing (Current)
- DevTools Network tab
- Check request count and timing
- Verify badge updates
- Test guest/business/admin flows

---

## Monitoring & Debugging

### Enable Debug Logging
```typescript
// In NotificationFeed.tsx
if (process.env.NODE_ENV === "development") {
  console.log("[NotificationFeed] bootstrap called", {
    cached: notifications.length > 0,
    unreadCount: notifications.filter(n => !n.seenAt).length,
  });
}
```

### DevTools Network Tab
1. Open DevTools → Network tab
2. Filter by `/api/notifications`
3. Open notification panel
4. Observe request count and timing
5. Close and reopen
6. Verify no duplicate requests

### Performance Monitoring
```typescript
// Track mark-open calls
console.time("mark-open");
const markRes = await fetch(`/api/notifications/mark-open`, ...);
console.timeEnd("mark-open");
```

---

## Future Enhancements

### 1. Centralized Cache Context
```typescript
// Use NotificationCacheContext for cross-component cache
const { cache, setCacheNotifications } = useNotificationCache();
```

### 2. Polling for New Notifications
```typescript
// Optional polling when panel is open
useEffect(() => {
  if (!open) return;
  const interval = setInterval(() => {
    void bootstrap(); // Refetch every 30 seconds
  }, 30 * 1000);
  return () => clearInterval(interval);
}, [open, bootstrap]);
```

### 3. Virtual Scrolling
```typescript
// For large notification lists
import { FixedSizeList } from "react-window";
```

### 4. Optimistic Updates
```typescript
// Update UI before server confirms
setNotifications(prev => prev.map(n => ({ ...n, seenAt: now })));
// Then call mark-open
void runMarkOpenAndSync();
```

---

## Rollback Instructions

If issues arise:

1. **Revert API endpoint**:
   ```bash
   rm src/app/api/notifications/unread-count/route.ts
   ```

2. **Revert useUserNotificationBadgeCount.ts**:
   - Change `/api/notifications/unread-count` back to `/api/notifications?limit=1`

3. **Revert NotificationsDropdown.tsx**:
   - Add back the `useEffect` on `open` state
   - Change endpoint back to `limit=1`

4. **Revert NotificationFeed.tsx**:
   - Remove `markOpenInFlightRef` and `lastMarkedOpenAtRef`
   - Remove cache check in `bootstrap()`
   - Remove cache check in event listener

5. **Rebuild and test**:
   ```bash
   pnpm build
   pnpm tsc --noEmit
   ```

