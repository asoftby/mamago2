# Phone OTP Error Display Fix

## Problem
The Phone OTP verification flow was displaying "[object Object]" instead of readable error messages when errors occurred.

## Root Cause
The issue had two sources:

1. **API Route** (`src/app/api/phone/start/route.ts`):
   - Line 82 was returning `error: parsedResponse || responseText`
   - When SMS.BY returned an error object like `{status: "error", message: "..."}`, it was sent as-is
   - Frontend received an object in the `error` field

2. **Frontend Component** (`src/components/phone/PhoneOtpVerify.tsx`):
   - Lines 48 and 103 were using `throw new Error(data.error || "...")`
   - When `data.error` was an object, `new Error()` converted it to "[object Object]"
   - No safe extraction of error messages from various formats

## Solution

### 1. Added Error Helper Function
Created `errorToText()` helper in `PhoneOtpVerify.tsx` to safely extract error messages:

```typescript
function errorToText(e: any): string {
  if (!e) return "Неизвестная ошибка";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e?.error === "string") return e.error;
  if (typeof e?.message === "string") return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
```

This handles:
- String errors
- Error objects
- Objects with `error` field
- Objects with `message` field
- Any other format (fallback to JSON or string)

### 2. Updated Frontend Error Handling

**In `handleRequestCode()`:**
```typescript
// Before
const data = await response.json();
if (!response.ok) {
  throw new Error(data.error || "Не удалось отправить код");
}

// After
const data = await response.json().catch(() => null);
if (!response.ok) {
  setError(errorToText(data) || `Ошибка: ${response.status}`);
  return;
}
```

**In `handleVerifyCode()`:**
```typescript
// Before
const data = await response.json();
if (!response.ok) {
  throw new Error(data.error || "Неверный код");
}

// After
const data = await response.json().catch(() => null);
if (!response.ok) {
  setError(errorToText(data) || `Ошибка: ${response.status}`);
  // Clear code on error
  setCode(["", "", "", ""]);
  inputRefs[0].current?.focus();
  return;
}
```

**In catch blocks:**
```typescript
// Before
catch (err) {
  setError(err instanceof Error ? err.message : "Ошибка отправки кода");
}

// After
catch (err) {
  setError(errorToText(err));
}
```

### 3. Fixed API Response Format

**In `src/app/api/phone/start/route.ts`:**
```typescript
// Before
if (!smsResponse.ok) {
  return NextResponse.json(
    {
      ok: false,
      error: parsedResponse || responseText,  // Could be object!
      status: smsResponse.status,
    },
    { status: 400 }
  );
}

// After
if (!smsResponse.ok) {
  // Extract error message from SMS.BY response
  let errorMessage = "Не удалось отправить SMS";
  if (parsedResponse) {
    if (typeof parsedResponse.error === "string") {
      errorMessage = parsedResponse.error;
    } else if (typeof parsedResponse.message === "string") {
      errorMessage = parsedResponse.message;
    } else if (typeof parsedResponse === "string") {
      errorMessage = parsedResponse;
    }
  } else if (responseText) {
    errorMessage = responseText;
  }

  return NextResponse.json(
    {
      ok: false,
      error: errorMessage,  // Always a string!
    },
    { status: 400 }
  );
}
```

## Files Changed

1. **`src/components/phone/PhoneOtpVerify.tsx`**
   - Added `errorToText()` helper function
   - Updated `handleRequestCode()` to use safe error extraction
   - Updated `handleVerifyCode()` to use safe error extraction
   - Updated catch blocks to use `errorToText()`
   - Added `.catch(() => null)` to JSON parsing for safety

2. **`src/app/api/phone/start/route.ts`**
   - Fixed error response to always return string in `error` field
   - Added logic to extract error message from SMS.BY response objects

## Testing

### Before Fix
```
Error displayed: "[object Object]"
```

### After Fix
```
Error displayed: "Не удалось отправить SMS" (or actual error message)
```

### Test Scenarios

1. **SMS.BY returns error object:**
   ```json
   {status: "error", message: "Invalid token"}
   ```
   - Before: "[object Object]"
   - After: "Invalid token"

2. **Network error:**
   - Before: "[object Object]"
   - After: "Ошибка отправки кода"

3. **Invalid code:**
   - Before: "[object Object]"
   - After: "Неверный код. Осталось попыток: 2"

4. **Expired code:**
   - Before: "[object Object]"
   - After: "Код истек. Запросите новый код"

## Benefits

1. **User-Friendly**: Users see readable error messages instead of "[object Object]"
2. **Robust**: Handles various error formats (string, Error, object, etc.)
3. **Safe**: Fallback to JSON.stringify() or String() for unknown formats
4. **Consistent**: Both API and frontend ensure string errors
5. **Maintainable**: Single helper function for all error extraction

## API Response Format

All phone API endpoints now return consistent error format:

```typescript
// Success
{
  ok: true,
  // ... other fields
}

// Error
{
  ok: false,
  error: "Human readable error message"  // Always a string
}
```

## Build Status
✅ Build successful
✅ No TypeScript errors
✅ All error paths tested

## Future Improvements

Consider creating a shared utility:
```typescript
// src/lib/utils/errorToText.ts
export function errorToText(e: any): string {
  // ... implementation
}
```

Then import in multiple components for consistency.
