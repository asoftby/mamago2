# SMS.BY Diagnostic Implementation - Summary

## What Was Done

Created a minimal diagnostic version of `/api/phone/start` to test SMS.BY integration and identify why SMS messages are not being sent.

## Files Created/Modified

### 1. `.env.local` (NEW)
Environment configuration for SMS.BY:
```env
SMS_BY_BASE_URL=https://app.sms.by
SMS_BY_TOKEN=YOUR_TOKEN_HERE
```

**ACTION REQUIRED:** Replace `YOUR_TOKEN_HERE` with your actual SMS.BY API token from https://app.sms.by/

### 2. `src/app/api/phone/start/route.ts` (MODIFIED)
Replaced with diagnostic version that:
- Removes auth/validation (temporary)
- Sends hardcoded test SMS
- Logs detailed debug info
- Returns raw SMS.BY response

### 3. `src/app/api/phone/start/route.ts.backup` (NEW)
Backup of original implementation for restoration after diagnosis.

### 4. `SMS_BY_DIAGNOSTIC.md` (NEW)
Comprehensive diagnostic guide with:
- Setup instructions
- Testing methods
- Expected output
- Troubleshooting guide
- SMS.BY API reference

### 5. `scripts/manual-tests/test-sms.sh` (NEW)
Bash script for quick testing:
```bash
./scripts/manual-tests/test-sms.sh
```

## Quick Start

### Step 1: Configure Token
Edit `.env.local` and add your SMS.BY token:
```env
SMS_BY_TOKEN=your_actual_token_here
```

### Step 2: Update Test Phone
Edit `src/app/api/phone/start/route.ts` line 28:
```typescript
const testPhone = "375291234567"; // Your phone number
```

### Step 3: Restart Server
**CRITICAL:** Must restart for env changes to take effect
```bash
pnpm dev
```

### Step 4: Test
```bash
# Option 1: Use test script
./scripts/manual-tests/test-sms.sh

# Option 2: Use curl
curl -i -X POST http://localhost:3000/api/phone/start

# Option 3: Click "Получить код" button in app
```

## What to Look For

### Console Output (Server)
```
🔥 PHONE START HIT
✅ SMS_BY_TOKEN found
📱 Sending test SMS to 375291234567
🌐 SMS.BY URL: https://app.sms.by/api/v1/sendQuickSMS
📨 SMS.BY Response:
   Status: 200
   OK: true
   Body: {"status":"success","message_id":"12345"}
```

### Browser Response
```json
{
  "ok": true,
  "status": 200,
  "text": "{\"status\":\"success\",\"message_id\":\"12345\"}",
  "parsed": {
    "status": "success",
    "message_id": "12345"
  },
  "testData": {
    "phone": "375291234567",
    "message": "TEST mamaGo"
  }
}
```

## Common Issues

### "SMS_BY_TOKEN missing"
- Token not in `.env.local`
- Server not restarted after adding token
- **Fix:** Add token, restart server

### Status 401 (Unauthorized)
- Invalid or expired token
- **Fix:** Get new token from SMS.BY dashboard

### Status 402 (Payment Required)
- Insufficient balance
- **Fix:** Top up SMS.BY account

### Status 200 but no SMS
- Wrong phone format
- Delivery delay (wait 1-2 min)
- **Fix:** Check phone number, check SMS.BY dashboard

## After Diagnosis

### If Working
1. Verify SMS received on phone
2. Check SMS.BY dashboard for delivery confirmation
3. Restore original implementation:
   ```bash
   cp src/app/api/phone/start/route.ts.backup src/app/api/phone/start/route.ts
   ```
4. Integrate SMS.BY into production code

### If Not Working
1. Review console logs
2. Check SMS.BY dashboard API logs
3. Verify account status and balance
4. Contact SMS.BY support with error details

## Security Reminders

- ⚠️ **Never commit `.env.local`** to git
- ⚠️ Keep SMS.BY token secret
- ⚠️ This is a diagnostic version - restore original after testing
- ⚠️ Update `.gitignore` to exclude `.env.local`

## Restoration

After diagnosis is complete, restore the original implementation:

```bash
# Restore from backup
cp src/app/api/phone/start/route.ts.backup src/app/api/phone/start/route.ts

# Restart server
pnpm dev
```

Then integrate SMS.BY properly by uncommenting and updating the SMS sending code in the original implementation.

## Next Steps

1. **Configure token** in `.env.local`
2. **Update test phone** in route.ts
3. **Restart server** with `pnpm dev`
4. **Run test** with `./scripts/manual-tests/test-sms.sh` or curl
5. **Check logs** in console and SMS.BY dashboard
6. **Restore original** after diagnosis
7. **Integrate SMS.BY** into production code
