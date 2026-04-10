# SMS.BY Two-Step Flow Implementation

## Overview
Switched from `sendQuickSMS` to the official 2-step flow (`createSmsMessage` + `sendSms`) to support alphaname_id=4720 for proper sender identification.

## Why the Change?
- `sendQuickSMS` doesn't support `alphaname_id` parameter
- Two-step flow allows using registered alphaname ID (4720) for "mamaGo.by"
- Provides better control and tracking of SMS messages

## Implementation

### Step 1: Create SMS Message
**Endpoint**: `POST https://app.sms.by/api/v1/createSmsMessage`

**Headers**:
```
Content-Type: application/x-www-form-urlencoded
```

**Body** (URL-encoded):
```
token=YOUR_TOKEN
message=Ваш код подтверждения: 1234
alphaname_id=4720
```

**Response**:
```json
{
  "message_id": "12345"
}
```

### Step 2: Send SMS to Phone
**Endpoint**: `POST https://app.sms.by/api/v1/sendSms`

**Headers**:
```
Content-Type: application/x-www-form-urlencoded
```

**Body** (URL-encoded):
```
token=YOUR_TOKEN
message_id=12345
phone=375291234567
```

**Response**:
```json
{
  "sms_id": "67890",
  "status": "NEW"
}
```

## Code Changes

### File: `src/app/api/phone/start/route.ts`

#### Before (sendQuickSMS):
```typescript
const requestBody = {
  token: smsToken,
  phone: normalizedPhone,
  message: `Ваш код подтверждения: ${otpCode}`,
  sender: smsSender,
};

const smsResponse = await fetch(`${baseUrl}/api/v1/sendQuickSMS`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(requestBody),
});
```

#### After (Two-Step Flow):
```typescript
// STEP 1: Create SMS message
const createParams = new URLSearchParams({
  token: smsToken,
  message: message,
  alphaname_id: "4720",
});

const createResponse = await fetch(`${baseUrl}/api/v1/createSmsMessage`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: createParams.toString(),
});

const messageId = createData?.message_id;

// STEP 2: Send SMS
const sendParams = new URLSearchParams({
  token: smsToken,
  message_id: messageId,
  phone: normalizedPhone,
});

const sendResponse = await fetch(`${baseUrl}/api/v1/sendSms`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: sendParams.toString(),
});
```

## Error Handling

### Step 1 Errors
If `createSmsMessage` fails:
```typescript
if (!createResponse.ok) {
  let errorMessage = "Не удалось создать SMS сообщение";
  if (createData?.error) errorMessage = createData.error;
  else if (createData?.message) errorMessage = createData.message;
  else if (createText) errorMessage = createText;
  
  return NextResponse.json({ ok: false, error: errorMessage }, { status: 400 });
}
```

### Step 2 Errors
If `sendSms` fails:
```typescript
if (!sendResponse.ok) {
  let errorMessage = "Не удалось отправить SMS";
  if (sendData?.error) errorMessage = sendData.error;
  else if (sendData?.message) errorMessage = sendData.message;
  else if (sendText) errorMessage = sendText;
  
  return NextResponse.json({ ok: false, error: errorMessage }, { status: 400 });
}
```

### Missing message_id
```typescript
if (!messageId) {
  return NextResponse.json(
    { ok: false, error: "Не получен message_id от SMS.BY" },
    { status: 500 }
  );
}
```

## Key Differences

| Feature | sendQuickSMS | Two-Step Flow |
|---------|--------------|---------------|
| **Endpoints** | 1 endpoint | 2 endpoints |
| **Content-Type** | application/json | application/x-www-form-urlencoded |
| **Alphaname** | sender (string) | alphaname_id (number) |
| **Phone** | In first request | In second request |
| **Message ID** | Not exposed | Returned and used |

## Testing

### Console Output (Success)
```
🔥 PHONE START HIT
✅ SMS_BY_TOKEN found
✅ SMS_BY_SENDER found: mamaGo.by
📱 Sending test SMS to 375291234567 (normalized from +375291234567)
📝 Step 1: Creating SMS message...
📤 CREATE SMS BODY: { message: '...', alphaname_id: '4720', messageLength: 29 }
📨 CREATE Response:
   Status: 200
   OK: true
   Body: {"message_id":"12345"}
📋 CREATE PARSED: { message_id: '12345' }
✅ Message created with ID: 12345
📤 Step 2: Sending SMS to phone...
📤 SEND SMS BODY: { message_id: '12345', phone: '375291234567' }
📨 SEND Response:
   Status: 200
   OK: true
   Body: {"sms_id":"67890","status":"NEW"}
📋 SEND PARSED: { sms_id: '67890', status: 'NEW' }
✅ SMS sent successfully!
```

### Browser Response (Success)
```json
{
  "ok": true,
  "status": 200,
  "messageId": "12345",
  "createResponse": {
    "message_id": "12345"
  },
  "sendResponse": {
    "sms_id": "67890",
    "status": "NEW"
  },
  "testData": {
    "phoneE164": "+375291234567",
    "normalizedPhone": "375291234567",
    "message": "Ваш код подтверждения: 1234",
    "alphaname_id": "4720"
  }
}
```

## Benefits

1. **Proper Sender ID**: Uses registered alphaname_id (4720) for "mamaGo.by"
2. **Better Tracking**: Returns both message_id and sms_id for tracking
3. **More Control**: Separate steps allow for better error handling
4. **Official API**: Uses documented 2-step flow instead of quick method
5. **Robust Errors**: Always returns string errors, never objects

## Alphaname ID

The alphaname_id `4720` corresponds to the registered sender name "mamaGo.by" in SMS.BY cabinet.

To verify or get your alphaname_id:
1. Log in to https://app.sms.by/
2. Go to Settings → Alpha Names
3. Find "mamaGo.by" in the list
4. Note the ID (4720)

## Environment Variables

No changes needed. Still uses:
```env
SMS_BY_BASE_URL=https://app.sms.by
SMS_BY_TOKEN=your_token
SMS_BY_SENDER=mamaGo.by  # Not used in 2-step flow, but kept for reference
```

## Testing Instructions

### 1. Restart Server
```bash
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

### 3. Expected Results
- Console shows both steps completing successfully
- Browser receives `ok: true` with message_id and sms_id
- SMS arrives from "mamaGo.by" sender
- Message contains OTP code

## Common Issues

### Issue: "message_id not found"
**Cause**: Step 1 didn't return message_id
**Fix**: Check SMS.BY token and alphaname_id validity

### Issue: Step 1 succeeds but Step 2 fails
**Cause**: Invalid phone number or message_id
**Fix**: Verify phone format (no `+` prefix) and message_id from Step 1

### Issue: Wrong sender name displayed
**Cause**: Alphaname_id doesn't match registered name
**Fix**: Verify alphaname_id=4720 is correct for "mamaGo.by"

### Issue: 400 Bad Request
**Cause**: Wrong Content-Type or body format
**Fix**: Ensure `application/x-www-form-urlencoded` and URLSearchParams

## Migration Notes

### What Changed
- ✅ Removed `sendQuickSMS` endpoint
- ✅ Added `createSmsMessage` + `sendSms` flow
- ✅ Changed Content-Type to `application/x-www-form-urlencoded`
- ✅ Changed from JSON body to URL-encoded params
- ✅ Added alphaname_id=4720
- ✅ Enhanced error handling for both steps

### What Stayed the Same
- ✅ Phone normalization (remove `+` prefix)
- ✅ Token authentication
- ✅ Error message extraction
- ✅ Frontend integration (no changes needed)
- ✅ OTP flow continues normally

## Build Status
✅ Build successful
✅ No TypeScript errors
✅ All error paths handled
✅ Robust error messages

## Next Steps

After successful testing:
1. Verify SMS arrives with correct sender "mamaGo.by"
2. Test error scenarios (invalid phone, wrong token, etc.)
3. Monitor SMS.BY dashboard for delivery status
4. Consider adding retry logic if needed
5. Update production environment with same flow
