# Place Autosave Disabled & Route Fix - Complete

## Problem
1. **PATCH /api/business/places/[id] returning 500 errors**
   - Prisma error: `params.id is undefined`
   - Route handler not awaiting params (Next.js 15+ requirement)
   - Missing ID validation guard

2. **Autosave causing spam requests**
   - Every keystroke triggers debounced API call
   - Creates noise in logs
   - Unnecessary network traffic
   - Should wait for manual save implementation

## Solution

### 1. Fixed Route Handler Params
**File:** `src/app/api/business/places/[id]/route.ts`

**Changes:**
- Updated all handlers (GET, PATCH, DELETE) to await params
- Added ID validation guard
- Improved error handling with proper JSON responses
- Added detailed logging

**Before:**
```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // params.id was undefined - Next.js 15+ requires await
  const existing = await prisma.place.findUnique({
    where: { id: params.id }, // ❌ undefined
  });
}
```

**After:**
```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // ✅ Await params
  
  if (!id) {
    return NextResponse.json(
      { error: "MISSING_ID", message: "Place ID is required" },
      { status: 400 }
    );
  }
  
  const existing = await prisma.place.findUnique({
    where: { id }, // ✅ Valid ID
  });
}
```

### 2. Disabled Autosave Hook
**File:** `src/app/business/(protected)/places/[id]/edit/hooks/useAutosave.ts`

**Changes:**
- Disabled API calls in `updatePlace()` function
- Added clear documentation comment
- Kept function signature for compatibility
- Logs what would have been saved (for debugging)
- Original code preserved in comments for future reference

**Behavior:**
```typescript
const updatePlace = useCallback(
  async (updates: Partial<Place>) => {
    // AUTOSAVE DISABLED - No-op
    console.log("[useAutosave] DISABLED - Would have saved:", updates);
    
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't make API call
    return;
  },
  [placeId, debounceMs, onSuccess, onError]
);
```

## Technical Details

### Next.js 15+ Params Change
In Next.js 15 and later, route params are now async:

**Old (Next.js 14):**
```typescript
{ params }: { params: { id: string } }
// params.id immediately available
```

**New (Next.js 15+):**
```typescript
{ params }: { params: Promise<{ id: string }> }
// Must await: const { id } = await params;
```

### Error Response Format
All errors now return consistent JSON:

```typescript
{
  error: "ERROR_CODE",
  message: "Human-readable description"
}
```

**Error Codes:**
- `MISSING_ID` (400) - ID parameter missing
- `UNAUTHORIZED` (401) - Not authenticated
- `FORBIDDEN` (403) - Not owner of place
- `NOT_FOUND` (404) - Place doesn't exist
- `HAS_CHILDREN` (400) - Complex has units
- `INTERNAL_SERVER_ERROR` (500) - Unexpected error

### Logging Format
Consistent logging across all handlers:

```typescript
console.error("[place-patch] ❌ Error:", error);
console.error("[place-patch] Stack:", error instanceof Error ? error.stack : "No stack");
```

## Testing

### Route Handler Tests
- [x] PATCH with valid ID → works
- [x] PATCH with missing ID → 400 MISSING_ID
- [x] PATCH with invalid ID → 404 NOT_FOUND
- [x] PATCH without auth → 401 UNAUTHORIZED
- [x] PATCH wrong owner → 403 FORBIDDEN
- [x] GET with valid ID → works
- [x] DELETE with valid ID → works
- [x] All errors return JSON (not HTML/empty)

### Autosave Tests
- [x] Edit field → no API call
- [x] Console shows "DISABLED - Would have saved"
- [x] No network requests in DevTools
- [x] No 500 errors in terminal
- [x] Page remains stable

## User Experience

### Before Fix
1. User edits title
2. Autosave triggers after 500ms
3. API call fails with 500 error
4. Error logged to console
5. User sees no feedback
6. Repeat for every field change

### After Fix
1. User edits title
2. Autosave hook called but does nothing
3. Console log: "DISABLED - Would have saved: {title: '...'}"
4. No API call
5. No errors
6. Page remains stable

## Next Steps

### Manual Save Implementation
See: `PLACE_WIZARD_MANUAL_SAVE_IMPLEMENTATION.md`

1. Add "Сохранить черновик" button to each step
2. Add dirty state tracking
3. Save on "Далее" button
4. Add beforeunload warning
5. Re-enable autosave hook with manual trigger

### Re-enabling Autosave
When manual save is implemented:

1. Remove the no-op code from `useAutosave.ts`
2. Uncomment original autosave logic
3. Change trigger from onChange to manual button click
4. Keep debounce for performance

## Files Changed

### Modified
1. `src/app/api/business/places/[id]/route.ts`
   - Fixed params handling (await)
   - Added ID validation
   - Improved error responses
   - Enhanced logging

2. `src/app/business/(protected)/places/[id]/edit/hooks/useAutosave.ts`
   - Disabled autosave functionality
   - Added documentation
   - Preserved original code in comments

### Created
1. `PLACE_AUTOSAVE_DISABLED_FIX.md` - This document

## Rollback Plan

### If Issues Arise

**Rollback Route Handler:**
```bash
git checkout HEAD~1 -- src/app/api/business/places/[id]/route.ts
```

**Re-enable Autosave:**
```bash
git checkout HEAD~1 -- src/app/business/(protected)/places/[id]/edit/hooks/useAutosave.ts
```

## Monitoring

### Logs to Watch
```
[place-patch] Update data: {...}
[useAutosave] DISABLED - Would have saved: {...}
```

### Errors to Monitor
- No more "params.id is undefined"
- No more 500 errors from PATCH endpoint
- No autosave network requests

### Metrics
- API error rate should drop to ~0%
- Network requests reduced significantly
- Page load/interaction smoother

## Related Issues

### Issue #1: Params Undefined
**Root Cause:** Next.js 15+ requires awaiting params
**Fix:** Updated all route handlers to await params
**Status:** ✅ Fixed

### Issue #2: Autosave Spam
**Root Cause:** Autosave on every field change
**Fix:** Disabled autosave hook
**Status:** ✅ Fixed (temporary)

### Issue #3: Manual Save Missing
**Root Cause:** No manual save buttons implemented
**Fix:** Planned in PLACE_WIZARD_MANUAL_SAVE_IMPLEMENTATION.md
**Status:** 📋 Planned

## Success Criteria

✅ No 500 errors from PATCH endpoint
✅ Missing ID returns 400 with JSON
✅ All errors return proper JSON responses
✅ Autosave disabled (no API calls)
✅ Console shows disabled autosave logs
✅ Edit page remains stable
✅ No network spam in DevTools
✅ TypeScript compiles without errors

## Conclusion

The route handler params issue is fixed and autosave is temporarily disabled. The wizard now works stably without spam requests. Manual save implementation can proceed according to the plan in `PLACE_WIZARD_MANUAL_SAVE_IMPLEMENTATION.md`.
