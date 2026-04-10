# 🚀 START HERE - SMS.BY Diagnostic

## Quick Setup (3 Steps)

### 1️⃣ Add Your SMS.BY Token

Edit `.env.local` in the project root:

```env
SMS_BY_TOKEN=your_actual_token_here
```

Get your token from: https://app.sms.by/ → API Settings

### 2️⃣ Update Test Phone Number

Edit `src/app/api/phone/start/route.ts` line 28:

```typescript
const testPhoneE164 = "+375291234567"; // Replace with YOUR number
```

Format: `+375XXXXXXXXX` (with `+` prefix - will be normalized automatically)

### 3️⃣ Restart Server

```bash
# Stop current server (Ctrl+C)
pnpm dev
```

## 🧪 Run Test

```bash
./scripts/manual-tests/test-sms.sh
```

Or:

```bash
curl -i -X POST http://localhost:3000/api/phone/start
```

## ✅ Success Looks Like

### Console (Server)
```
🔥 PHONE START HIT
✅ SMS_BY_TOKEN found
📱 Sending test SMS to 375291234567
📨 SMS.BY Response:
   Status: 200
   OK: true
```

### Browser Response
```json
{
  "ok": true,
  "status": 200,
  "parsed": {
    "status": "success",
    "message_id": "12345"
  }
}
```

### Your Phone
You should receive: "TEST mamaGo"

## ❌ Common Problems

| Error | Fix |
|-------|-----|
| "SMS_BY_TOKEN missing" | Add token to `.env.local`, restart server |
| Status 401 | Invalid token - get new one from SMS.BY |
| Status 402 | Top up SMS.BY account balance |
| Status 200, no SMS | Wait 1-2 min, check phone format |

## 📚 Full Documentation

- **SMS_DIAGNOSTIC_SUMMARY.md** - Quick overview
- **SMS_BY_DIAGNOSTIC.md** - Complete guide with troubleshooting
- **scripts/manual-tests/test-sms.sh** - Test script

## 🔄 After Testing

Once SMS sending works, restore the original implementation:

```bash
cp src/app/api/phone/start/route.ts.backup src/app/api/phone/start/route.ts
pnpm dev
```

Then integrate SMS.BY into the production code.

## 🆘 Need Help?

1. Check server console logs
2. Check SMS.BY dashboard: https://app.sms.by/
3. Review **SMS_BY_DIAGNOSTIC.md** troubleshooting section
4. Contact SMS.BY support with error details

---

**⚠️ IMPORTANT:** This is a diagnostic version. Restore original after testing!
