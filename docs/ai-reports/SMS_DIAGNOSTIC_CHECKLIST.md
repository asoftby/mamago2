# SMS.BY Diagnostic Checklist

Use this checklist to ensure proper setup and testing.

## Pre-Testing Setup

- [ ] **Get SMS.BY Token**
  - Go to https://app.sms.by/
  - Log in to your account
  - Navigate to API settings
  - Copy your API token

- [ ] **Configure Environment**
  - Open `.env.local` in project root
  - Replace `YOUR_TOKEN_HERE` with actual token
  - Verify `SMS_BY_BASE_URL=https://app.sms.by`

- [ ] **Update Test Phone**
  - Open `src/app/api/phone/start/route.ts`
  - Line 28: Change `375291234567` to your phone number
  - Format: `375XXXXXXXXX` (no `+` prefix)

- [ ] **Restart Server**
  - Stop current server (Ctrl+C)
  - Run `pnpm dev`
  - Wait for "Ready" message

## Testing

- [ ] **Run Test Script**
  ```bash
  ./scripts/manual-tests/test-sms.sh
  ```

- [ ] **Check Console Output**
  - [ ] See "🔥 PHONE START HIT"
  - [ ] See "✅ SMS_BY_TOKEN found"
  - [ ] See "📱 Sending test SMS to..."
  - [ ] See "📨 SMS.BY Response:"
  - [ ] Status is 200
  - [ ] OK is true

- [ ] **Check Browser Response**
  - [ ] `ok: true`
  - [ ] `status: 200`
  - [ ] `parsed.status: "success"`
  - [ ] `parsed.message_id` exists

- [ ] **Check Phone**
  - [ ] Wait 1-2 minutes
  - [ ] Receive SMS with "TEST mamaGo"

- [ ] **Check SMS.BY Dashboard**
  - [ ] Go to https://app.sms.by/
  - [ ] Check sent messages
  - [ ] Verify message appears
  - [ ] Check delivery status

## Troubleshooting

If test fails, check:

- [ ] **Token Issues**
  - [ ] Token is correct (no typos)
  - [ ] Token is not expired
  - [ ] Account is active
  - [ ] Server was restarted after adding token

- [ ] **Phone Issues**
  - [ ] Phone number format is correct
  - [ ] No `+` prefix
  - [ ] Starts with country code (375 for Belarus)
  - [ ] Phone number is valid and active

- [ ] **Account Issues**
  - [ ] SMS.BY account has sufficient balance
  - [ ] Account is not suspended
  - [ ] API access is enabled

- [ ] **Network Issues**
  - [ ] Internet connection is working
  - [ ] Can access https://app.sms.by/ in browser
  - [ ] No firewall blocking outbound requests
  - [ ] No proxy issues

## After Successful Test

- [ ] **Verify SMS Received**
  - [ ] SMS received on test phone
  - [ ] Message content is correct
  - [ ] Delivery was timely (< 2 minutes)

- [ ] **Check SMS.BY Dashboard**
  - [ ] Message shows as "delivered"
  - [ ] Balance was deducted
  - [ ] No error messages

- [ ] **Document Results**
  - [ ] Note response time
  - [ ] Note any issues encountered
  - [ ] Save console logs if needed

- [ ] **Restore Original Code**
  ```bash
  cp src/app/api/phone/start/route.ts.backup src/app/api/phone/start/route.ts
  ```

- [ ] **Integrate SMS.BY**
  - [ ] Uncomment SMS sending code in original
  - [ ] Update with correct token usage
  - [ ] Test with actual OTP flow
  - [ ] Verify phone verification works end-to-end

## Production Readiness

Before deploying to production:

- [ ] **Environment**
  - [ ] Production token configured
  - [ ] Token stored securely (not in code)
  - [ ] Environment variables set correctly

- [ ] **Code**
  - [ ] Original implementation restored
  - [ ] SMS.BY integration working
  - [ ] Error handling in place
  - [ ] Logging configured (no sensitive data)

- [ ] **Account**
  - [ ] SMS.BY account topped up
  - [ ] Sufficient balance for expected volume
  - [ ] Alphaname approved (if using custom sender)
  - [ ] Rate limits understood

- [ ] **Testing**
  - [ ] End-to-end OTP flow tested
  - [ ] Multiple phone numbers tested
  - [ ] Error scenarios tested
  - [ ] Rate limiting tested

- [ ] **Monitoring**
  - [ ] SMS delivery monitoring set up
  - [ ] Balance alerts configured
  - [ ] Error logging in place
  - [ ] Dashboard access for team

## Common Error Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Check phone for SMS |
| 400 | Bad Request | Check phone format, message content |
| 401 | Unauthorized | Check token, verify account |
| 402 | Payment Required | Top up account balance |
| 403 | Forbidden | Check API access, account status |
| 429 | Too Many Requests | Implement rate limiting |
| 500 | Server Error | Contact SMS.BY support |

## Support Resources

- **SMS.BY Dashboard**: https://app.sms.by/
- **SMS.BY Documentation**: Check dashboard for API docs
- **Project Documentation**: 
  - `START_HERE_SMS_DIAGNOSTIC.md` - Quick start
  - `SMS_DIAGNOSTIC_SUMMARY.md` - Overview
  - `SMS_BY_DIAGNOSTIC.md` - Full guide

## Notes

Use this space to document your specific findings:

```
Date: _______________
Token Status: _______________
Test Phone: _______________
Result: _______________
Issues: _______________
Resolution: _______________
```
