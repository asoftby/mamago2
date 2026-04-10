# SMS.BY Integration Diagnostic Guide

## Problem
SMS messages are not being sent via SMS.BY when calling POST /api/phone/start. Nothing appears in the SMS.BY dashboard.

## Diagnostic Implementation

### Files Modified
1. **`.env.local`** - Created with SMS.BY configuration
2. **`src/app/api/phone/start/route.ts`** - Replaced with diagnostic version
3. **`src/app/api/phone/start/route.ts.backup`** - Backup of original implementation

### What the Diagnostic Version Does
- Removes all authentication and validation logic
- Sends a hardcoded test SMS to verify SMS.BY integration
- Logs detailed information to console
- Returns raw SMS.BY response to browser for inspection

## Setup Instructions

### Step 1: Configure Environment Variables

Edit `.env.local` in the project root:

```env
SMS_BY_BASE_URL=https://app.sms.by
SMS_BY_TOKEN=YOUR_ACTUAL_TOKEN_HERE
```

**Get your SMS.BY token:**
1. Go to https://app.sms.by/
2. Log in to your account
3. Navigate to API settings
4. Copy your API token
5. Replace `YOUR_ACTUAL_TOKEN_HERE` in `.env.local`

### Step 2: Update Test Phone Number

Edit `src/app/api/phone/start/route.ts` line 28:

```typescript
const testPhone = "375291234567"; // Replace with YOUR test number
```

**Important:** Use your actual phone number in international format without the `+` prefix.

### Step 3: Restart Dev Server

**CRITICAL:** Environment variables are only loaded on server start.

```bash
# Stop the current dev server (Ctrl+C)
pnpm dev
```

## Testing

### Method 1: Using cURL

```bash
curl -i -X POST http://localhost:3000/api/phone/start
```

### Method 2: Using Browser

Navigate to your app and click the "Получить код" button in the business onboarding form.

### Method 3: Using Browser Console

```javascript
fetch('http://localhost:3000/api/phone/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log)
```

## Expected Output

### Console Logs (Server)
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

### Browser Response (Success)
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

### Browser Response (Token Missing)
```json
{
  "ok": false,
  "error": "SMS_BY_TOKEN missing or not configured in .env.local"
}
```

## Troubleshooting

### Issue: "SMS_BY_TOKEN missing"
**Solution:**
1. Verify `.env.local` exists in project root
2. Verify token is not `YOUR_TOKEN_HERE`
3. Restart dev server: `pnpm dev`

### Issue: Status 401 (Unauthorized)
**Possible causes:**
- Invalid or expired SMS.BY token
- Token not activated in SMS.BY dashboard

**Solution:**
1. Log in to https://app.sms.by/
2. Verify your account is active
3. Generate a new API token
4. Update `.env.local`
5. Restart dev server

### Issue: Status 400 (Bad Request)
**Possible causes:**
- Invalid phone number format
- Missing required fields

**Solution:**
1. Check phone number format (should be digits only, no `+`)
2. Verify SMS.BY API documentation for required fields
3. Check console logs for SMS.BY error message

### Issue: Status 402 (Payment Required)
**Possible causes:**
- Insufficient balance in SMS.BY account
- Account not topped up

**Solution:**
1. Log in to https://app.sms.by/
2. Check account balance
3. Top up account if needed

### Issue: Status 200 but no SMS received
**Possible causes:**
- Phone number not in correct format
- SMS delivery delay
- Phone number blocked/invalid

**Solution:**
1. Wait 1-2 minutes for SMS delivery
2. Check phone number format (should be `375XXXXXXXXX`)
3. Try a different phone number
4. Check SMS.BY dashboard for delivery status

### Issue: Network error / Timeout
**Possible causes:**
- Firewall blocking outbound requests
- SMS.BY API down
- Network connectivity issues

**Solution:**
1. Check internet connection
2. Try accessing https://app.sms.by/ in browser
3. Check if corporate firewall blocks SMS.BY
4. Try from different network

## SMS.BY API Reference

### Endpoint
```
POST https://app.sms.by/api/v1/sendQuickSMS
```

### Request Body
```json
{
  "token": "your_api_token",
  "phone": "375291234567",
  "message": "Your message text",
  "alphaname": "mamaGo"
}
```

### Response (Success)
```json
{
  "status": "success",
  "message_id": "12345"
}
```

### Response (Error)
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Next Steps After Diagnosis

### If SMS Sending Works
1. Check SMS.BY dashboard to confirm message was sent
2. Verify SMS was received on test phone
3. Restore original implementation with SMS.BY integration
4. Update original route to use actual phone numbers and OTP codes

### If SMS Sending Fails
1. Review console logs for error details
2. Check SMS.BY dashboard for API logs
3. Verify account status and balance
4. Contact SMS.BY support if needed

## Restoring Original Implementation

Once diagnosis is complete, restore the original implementation:

```bash
# Restore from backup
cp src/app/api/phone/start/route.ts.backup src/app/api/phone/start/route.ts
```

Or manually integrate SMS.BY into the original code by uncommenting the SMS sending section.

## Security Notes

- **Never commit `.env.local`** to version control
- Add `.env.local` to `.gitignore`
- Keep SMS.BY token secret
- Use environment variables for all sensitive data
- In production, use proper secret management

## Files to Restore After Diagnosis

1. `src/app/api/phone/start/route.ts` - Restore from backup
2. `.env.local` - Keep for production use (update token)

## Production Checklist

- [ ] SMS.BY token configured in production environment
- [ ] Phone number validation restored
- [ ] Authentication checks restored
- [ ] OTP generation and storage restored
- [ ] Error handling restored
- [ ] Rate limiting implemented
- [ ] Logging configured (without exposing sensitive data)
- [ ] SMS.BY account topped up with sufficient balance
- [ ] Alphaname approved by SMS.BY (if using custom sender)
