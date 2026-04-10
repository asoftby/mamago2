# SMS.BY Sender Name Fix

## Problem
SMS.BY was returning 400 error with `{"error":"ошибка в буквенном имени"}` (error in alpha name).

## Root Causes
1. **Wrong sender name**: Using `"mamaGo"` instead of registered `"mamaGo.by"`
2. **Wrong API format**: Using `recipient` field instead of `phone`
3. **Wrong authentication**: Using `Authorization: Bearer` header instead of `token` in body
4. **Hardcoded sender**: Not using environment variable

## Solution

### 1. Added Environment Variable
**File**: `.env.local`

Added:
```env
SMS_BY_SENDER=mamaGo.by
```

This matches the registered alpha-name in SMS.BY cabinet.

### 2. Fixed SMS.BY API Request Format
**File**: `src/app/api/phone/start/route.ts`

#### Before (WRONG):
```typescript
const requestBody = {
  recipient: normalizedPhone,  // Wrong field name
  message: `Ваш код подтверждения: ${otpCode}`,
  sender: "mamaGo",  // Wrong sender, hardcoded
};

const smsResponse = await fetch(smsUrl, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${smsToken}`,  // Wrong auth method
    "Content-Type": "application/json",
  },
  body: JSON.stringify(requestBody),
});
```

#### After (CORRECT):
```typescript
const requestBody = {
  token: smsToken,  // Token in body, not header
  phone: normalizedPhone,  // Correct field name
  message: `Ваш код подтверждения: ${otpCode}`,
  sender: process.env.SMS_BY_SENDER,  // From env: "mamaGo.by"
};

const smsResponse = await fetch(smsUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",  // No Authorization header
  },
  body: JSON.stringify(requestBody),
});
```

### 3. Added Validation and Debug Logging

```typescript
// Check if SMS_BY_SENDER is configured
const smsSender = process.env.SMS_BY_SENDER;
if (!smsSender) {
  console.error("❌ SMS_BY_SENDER missing");
  return NextResponse.json(
    {
      ok: false,
      error: "SMS_BY_SENDER missing in .env.local",
    },
    { status: 500 }
  );
}

console.log(`✅ SMS_BY_SENDER found: ${smsSender}`);

// Debug log before sending
console.log("📤 SMS BODY:", { 
  phone: normalizedPhone, 
  sender: smsSender,
  messageLength: requestBody.message.length 
});
```

## SMS.BY API Requirements

### Endpoint
```
POST https://app.sms.by/api/v1/sendQuickSMS
```

### Headers
```
Content-Type: application/json
```

**Note**: NO `Authorization` header! Token goes in body.

### Request Body
```json
{
  "token": "your_api_token",
  "phone": "375291234567",
  "message": "Your message text",
  "sender": "mamaGo.by"
}
```

### Phone Format
- Must NOT include `+` prefix
- Format: `375XXXXXXXXX` (country code + number)
- Example: `375291234567` ✅
- NOT: `+375291234567` ❌

### Sender Name
- Must match registered alpha-name in SMS.BY cabinet
- Case-sensitive
- Example: `mamaGo.by` (registered)
- NOT: `mamaGo` ❌

## Expected Response

### Success (HTTP 200)
```json
{
  "sms_id": "12345",
  "status": "NEW"
}
```

### Error (HTTP 400)
```json
{
  "error": "error description"
}
```

## Testing

### 1. Restart Server
**CRITICAL**: Environment variables are only loaded on server start.

```bash
# Stop current server (Ctrl+C)
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
✅ SMS_BY_SENDER found: mamaGo.by
📱 Sending test SMS to 375291234567 (normalized from +375291234567)
🌐 SMS.BY URL: https://app.sms.by/api/v1/sendQuickSMS
📤 SMS BODY: { phone: '375291234567', sender: 'mamaGo.by', messageLength: 29 }
📨 SMS.BY Response:
   Status: 200
   OK: true
   Body: {"sms_id":"12345","status":"NEW"}
```

### 4. Expected Browser Response
```json
{
  "ok": true,
  "status": 200,
  "parsed": {
    "sms_id": "12345",
    "status": "NEW"
  }
}
```

## Files Changed

1. **`.env.local`**
   - Added `SMS_BY_SENDER=mamaGo.by`

2. **`src/app/api/phone/start/route.ts`**
   - Changed `recipient` → `phone`
   - Changed `sender: "mamaGo"` → `sender: process.env.SMS_BY_SENDER`
   - Moved `token` from Authorization header to request body
   - Removed Authorization header
   - Added SMS_BY_SENDER validation
   - Added debug logging

## Common Issues

### Issue: "ошибка в буквенном имени"
**Cause**: Sender name doesn't match registered alpha-name
**Fix**: Use exact registered name from SMS.BY cabinet (e.g., `mamaGo.by`)

### Issue: 401 Unauthorized
**Cause**: Token in wrong place (header instead of body)
**Fix**: Put token in request body, not Authorization header

### Issue: 400 Bad Request
**Cause**: Wrong field names (`recipient` instead of `phone`)
**Fix**: Use correct field names as documented

### Issue: SMS_BY_SENDER missing
**Cause**: Environment variable not set or server not restarted
**Fix**: 
1. Add `SMS_BY_SENDER=mamaGo.by` to `.env.local`
2. Restart server: `pnpm dev`

## Production Deployment

### Environment Variables
Ensure production environment has:
```env
SMS_BY_BASE_URL=https://app.sms.by
SMS_BY_TOKEN=your_production_token
SMS_BY_SENDER=mamaGo.by
```

### Verify Sender Registration
1. Log in to https://app.sms.by/
2. Go to Settings → Alpha Names
3. Verify `mamaGo.by` is registered and approved
4. Use exact name (case-sensitive)

## Summary

The fix corrects three critical issues:
1. **Sender name**: Now uses registered `mamaGo.by` from environment
2. **API format**: Uses correct field names (`phone`, not `recipient`)
3. **Authentication**: Token in body, not Authorization header

These changes align with SMS.BY API requirements and should resolve the "ошибка в буквенном имени" error.

## Build Status
✅ Build successful
✅ No TypeScript errors
✅ Environment variable configured
✅ Debug logging added
