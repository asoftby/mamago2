# SMS.BY 400 Error Fix

## Problem
SMS.BY API was returning 400 Bad Request due to incorrect phone format and request body structure.

## Root Causes
1. Phone number included `+` prefix (SMS.BY expects digits only)
2. Incorrect field names in request body (`phone` instead of `recipient`)
3. Missing `Authorization: Bearer` header format
4. Missing `sender` field

## Changes Made

### File: `src/app/api/phone/start/route.ts`

#### 1. Phone Normalization
```typescript
// Before
const testPhone = "375291234567";

// After
const testPhoneE164 = "+375291234567";
const normalizedPhone = testPhoneE164.replace(/^\+/, ""); // Remove "+"
```

#### 2. Request Body Format
```typescript
// Before (WRONG)
{
  token: smsToken,
  phone: testPhone,
  message: testMessage
}

// After (CORRECT)
{
  recipient: normalizedPhone,  // Changed from "phone"
  message: `Ваш код подтверждения: ${otpCode}`,
  sender: "mamaGo"  // Added sender field
}
```

#### 3. Authorization Header
```typescript
// Before (WRONG)
headers: {
  "Content-Type": "application/json"
}

// After (CORRECT)
headers: {
  "Authorization": `Bearer ${smsToken}`,  // Added Bearer token
  "Content-Type": "application/json"
}
```

#### 4. Error Handling
```typescript
// Added proper error response
if (!smsResponse.ok) {
  return NextResponse.json(
    {
      ok: false,
      error: parsedResponse || responseText,
      status: smsResponse.status,
    },
    { status: 400 }
  );
}
```

#### 5. Debug Logging
```typescript
// Added detailed logging
console.log("📤 SMS REQUEST BODY:", requestBody);
console.log("📋 SMS RESPONSE:", parsedResponse);
```

## SMS.BY API Requirements

### Endpoint
```
POST https://app.sms.by/api/v1/sendQuickSMS
```

### Headers
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

### Request Body
```json
{
  "recipient": "375291234567",
  "message": "Your message text",
  "sender": "mamaGo"
}
```

### Phone Format
- Must NOT include `+` prefix
- Format: `375XXXXXXXXX` (country code + number)
- Example: `375291234567` ✅
- NOT: `+375291234567` ❌

## Testing

### 1. Restart Server
```bash
# IMPORTANT: Restart after code changes
pnpm dev
```

### 2. Run Test
```bash
./scripts/manual-tests/test-sms.sh
```

Or:

```bash
curl -i -X POST http://localhost:3000/api/phone/start
```

### 3. Expected Console Output
```
🔥 PHONE START HIT
✅ SMS_BY_TOKEN found
📱 Sending test SMS to 375291234567 (normalized from +375291234567)
🌐 SMS.BY URL: https://app.sms.by/api/v1/sendQuickSMS
📤 SMS REQUEST BODY: {
  recipient: '375291234567',
  message: 'Ваш код подтверждения: 1234',
  sender: 'mamaGo'
}
📨 SMS.BY Response:
   Status: 200
   OK: true
   Body: {"status":"success","message_id":"..."}
📋 SMS RESPONSE: { status: 'success', message_id: '...' }
```

### 4. Expected Browser Response
```json
{
  "ok": true,
  "status": 200,
  "parsed": {
    "status": "success",
    "message_id": "12345"
  },
  "testData": {
    "phoneE164": "+375291234567",
    "normalizedPhone": "375291234567",
    "message": "Ваш код подтверждения: 1234",
    "sender": "mamaGo"
  }
}
```

## Common Issues After Fix

### Issue: Still getting 400
**Check:**
- Token is valid and active
- Phone number format is correct (no spaces, dashes, or special chars)
- Sender name "mamaGo" is approved in SMS.BY dashboard

### Issue: 401 Unauthorized
**Check:**
- Token is correct in `.env.local`
- Using `Bearer` prefix in Authorization header
- Server was restarted after token update

### Issue: 402 Payment Required
**Check:**
- SMS.BY account has sufficient balance
- Top up account at https://app.sms.by/

### Issue: 403 Forbidden
**Check:**
- Sender name "mamaGo" is approved
- API access is enabled for your account
- Account is not suspended

## Next Steps

### If Test Succeeds
1. ✅ Verify SMS received on test phone
2. ✅ Check SMS.BY dashboard for delivery confirmation
3. ✅ Restore original implementation with SMS.BY integration
4. ✅ Update production code to use correct format

### Restore Original Implementation
```bash
cp src/app/api/phone/start/route.ts.backup src/app/api/phone/start/route.ts
```

Then update the original code with the correct SMS.BY format:
- Use `recipient` instead of `phone`
- Add `sender: "mamaGo"`
- Use `Authorization: Bearer` header
- Normalize phone by removing `+` prefix

## Production Integration

When integrating into production code:

```typescript
// In the original route.ts
const normalizedPhone = phoneE164.replace(/^\+/, "");

const smsResponse = await fetch("https://app.sms.by/api/v1/sendQuickSMS", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.SMS_BY_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    recipient: normalizedPhone,
    message: `Ваш код подтверждения: ${code4}`,
    sender: "mamaGo",
  }),
});
```

## Summary

The fix corrects three critical issues:
1. **Phone format**: Removes `+` prefix before sending to SMS.BY
2. **Request body**: Uses correct field names (`recipient`, `sender`)
3. **Authorization**: Uses proper `Bearer` token format

These changes align with SMS.BY API requirements and should resolve the 400 error.
