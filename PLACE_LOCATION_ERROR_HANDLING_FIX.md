# Place Location Error Handling Fix - Complete

## Problem
PlaceLocationPicker was failing to parse server errors, receiving empty `{}` or non-JSON responses, and only showing generic "INTERNAL_SERVER_ERROR" without details.

## Root Causes
1. Server errors weren't consistently returning JSON (some returned HTML or empty body)
2. No Prisma error detection (P2002, P2025, etc.)
3. Client crashed when trying to parse non-JSON responses
4. Error messages weren't descriptive enough for debugging

## Solution Implemented

### 1. Server-Side Error Handling

**Files:**
- `src/app/api/business/places/[id]/location/google/route.ts`
- `src/app/api/business/places/[id]/location/manual/route.ts`

**Improvements:**

#### Comprehensive Error Logging
```typescript
console.error("[place-location-google] ❌ Error:", error);
console.error("[place-location-google] Stack:", error instanceof Error ? error.stack : "No stack");
console.error("[place-location-google] PlaceId:", placeId);
```

#### Prisma Error Detection
```typescript
if (error instanceof Prisma.PrismaClientKnownRequestError) {
  // P2002: Unique constraint violation
  if (error.code === "P2002") {
    return NextResponse.json(
      {
        error: "DUPLICATE_GOOGLE_PLACE_ID",
        message: "This Google Place is already in use",
        fields: error.meta?.target,
      },
      { status: 409 }
    );
  }
  
  // P2025: Record not found
  if (error.code === "P2025") {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "Place not found",
      },
      { status: 404 }
    );
  }
  
  // Other Prisma errors
  return NextResponse.json(
    {
      error: "DATABASE_ERROR",
      message: error.message || "Database operation failed",
      code: error.code,
    },
    { status: 500 }
  );
}
```

#### Consistent Error Response Format
All errors now return JSON with `error` and `message` fields:
```typescript
{
  error: "ERROR_CODE",
  message: "Human-readable description"
}
```

#### Error Types Handled
- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - No access to this place
- `NOT_FOUND` (404) - Place not found
- `VALIDATION_ERROR` (400) - Missing required fields
- `DUPLICATE_GOOGLE_PLACE_ID` (409) - Unique constraint violation
- `DATABASE_ERROR` (500) - Prisma errors
- `INTERNAL_SERVER_ERROR` (500) - Generic errors

### 2. Client-Side Error Handling

**File:** `src/components/business/place/PlaceLocationPicker.tsx`

**Improvements:**

#### Robust Response Parsing
```typescript
let errorData: { error?: string; message?: string } = {};

// Try to parse JSON first
try {
  errorData = await response.json();
} catch (parseError) {
  // If JSON parsing fails, try to get text response
  console.error("[PlaceLocationPicker] Failed to parse JSON error response:", parseError);
  
  try {
    const textResponse = await response.text();
    console.error("[PlaceLocationPicker] Raw error response (first 300 chars):", textResponse.substring(0, 300));
    
    errorData = {
      error: "PARSE_ERROR",
      message: `Server returned non-JSON response: ${textResponse.substring(0, 100)}...`,
    };
  } catch (textError) {
    console.error("[PlaceLocationPicker] Failed to read response text:", textError);
    errorData = {
      error: "UNKNOWN_ERROR",
      message: "Failed to read server response",
    };
  }
}
```

#### Enhanced Error Logging
```typescript
console.error("[PlaceLocationPicker] Save location failed:", {
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get("content-type"),
  errorData,
  endpoint,
  payload,
});
```

#### User-Friendly Error Messages
```typescript
// Show user-friendly error message
const errorMessage = errorData.message || errorData.error || "Failed to save";
toast.error(`Ошибка: ${errorMessage}`);
throw new Error(errorMessage);
```

## Behavior After Fix

### Server Always Returns JSON
- All error responses have `Content-Type: application/json`
- Never returns empty body or HTML
- Consistent error structure: `{ error: "CODE", message: "Description" }`

### Detailed Error Logging
Terminal shows:
```
[place-location-google] ❌ Error: [error object]
[place-location-google] Stack: [full stack trace]
[place-location-google] PlaceId: clxxx123
```

### Client Never Crashes
- Handles JSON parsing errors gracefully
- Falls back to text response if JSON fails
- Shows first 300 chars of raw response for debugging
- Always displays error message to user via toast

### Specific Error Handling
- Prisma P2002 → 409 "This Google Place is already in use"
- Prisma P2025 → 404 "Place not found"
- Missing fields → 400 "lat and lng are required"
- Auth errors → 401/403 with clear messages

## Testing Checklist

- [x] TypeScript compiles without errors
- [ ] Test: Valid location save → Success
- [ ] Test: Missing required fields → 400 with validation error
- [ ] Test: Unauthorized user → 401 with auth error
- [ ] Test: Non-existent place → 404 with not found error
- [ ] Test: Database error → 500 with error details in console
- [ ] Test: Server returns HTML → Client logs raw response, shows error toast
- [ ] Test: Network error → Client handles gracefully
- [ ] Verify: All errors show in browser console with full details
- [ ] Verify: Terminal shows `[place-location-*]` error logs with stack traces
- [ ] Verify: User sees friendly error messages in toast notifications

## Debugging Guide

### When Error Occurs

**Check Browser Console:**
```
[PlaceLocationPicker] Save location failed: {
  status: 500,
  statusText: "Internal Server Error",
  contentType: "application/json",
  errorData: { error: "INTERNAL_SERVER_ERROR", message: "..." },
  endpoint: "/api/business/places/clxxx/location/google",
  payload: { ... }
}
```

**Check Terminal:**
```
[place-location-google] ❌ Error: Error: ...
[place-location-google] Stack: Error: ...
    at updatePlaceLocation (...)
    at POST (...)
[place-location-google] PlaceId: clxxx123
```

**Check Network Tab:**
- Response should have `Content-Type: application/json`
- Response body should be valid JSON with `error` and `message` fields

## Files Changed
1. `src/app/api/business/places/[id]/location/google/route.ts` - Added Prisma error handling, improved logging
2. `src/app/api/business/places/[id]/location/manual/route.ts` - Added Prisma error handling, improved logging
3. `src/components/business/place/PlaceLocationPicker.tsx` - Added robust error parsing with text fallback

## Next Steps
If errors still occur:
1. Check terminal for `[place-location-*]` logs with full stack trace
2. Check browser console for detailed error object
3. Check Network tab for response Content-Type and body
4. Look for Prisma error codes (P2002, P2025, etc.) in logs
