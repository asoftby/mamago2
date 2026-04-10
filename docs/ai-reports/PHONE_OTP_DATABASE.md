# Phone OTP Database Implementation

## Status: ✅ COMPLETE

## Summary

Replaced in-memory OTP storage with database-backed implementation using Prisma. OTP codes now persist across server restarts, HMR, and multiple instances.

## Changes Made

### A) Prisma Schema & Migration

**Added PhoneOtp model:**
```prisma
model PhoneOtp {
  id         String   @id @default(cuid())
  userId     String
  phoneE164  String
  purpose    String
  codeHash   String
  expiresAt  DateTime
  lastSentAt DateTime
  attempts   Int      @default(0)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([userId, phoneE164, purpose])
  @@index([userId, purpose])
  @@index([phoneE164, purpose])
}
```

**Migration applied:** `20260302230552_add_phone_otp`

### B) Shared Helpers

**1. Phone Normalization (`src/lib/phone/phoneNormalize.ts`)**
- `normalizePhoneToE164(input)` - Converts various formats to E.164
- Handles: `375...`, `80...`, `29/33/44/25...`, `+...`
- Returns: `+375XXXXXXXXX`

**2. OTP Utilities (`src/lib/otp/otp.ts`)**
- `genCode4()` - Generate random 4-digit code (0000-9999)
- `hashCode(code)` - HMAC-SHA256 hash using OTP_SECRET
- `safeEq(a, b)` - Timing-safe comparison using `timingSafeEqual`
- Requires `OTP_SECRET` env variable

**3. SMS.BY Client (`src/lib/sms/smsBy.ts`)**
- `sendQuickSms({ phoneDigits, message })` - Send SMS via SMS.BY
- Endpoint: `https://app.sms.by/api/v1/sendQuickSms`
- Content-Type: `application/x-www-form-urlencoded; charset=UTF-8`
- Body params: `token`, `phone`, `message`, `alphaname_id=4720`
- Returns parsed JSON response

### C) API Routes

**1. POST /api/phone/start**

Input:
```json
{
  "phone": "+375291234567",
  "purpose": "BUSINESS_PHONE_VERIFY"
}
```

Logic:
- Auth required (getCurrentUser)
- Normalize phone to E.164
- Check for existing OTP:
  - If expired → generate new code
  - If within 60s cooldown → return error with countdown
  - If cooldown passed → generate new code (can't resend hash)
- Generate 4-digit code, hash it, store in DB
- Send SMS: `mamaGo.by: код XXXX`
- Return: `{ ok: true, expiresAt, resendAfterSec: 60 }`

Constants:
- OTP_EXPIRY_MS = 10 minutes
- RESEND_COOLDOWN_SEC = 60 seconds

**2. POST /api/phone/verify**

Input:
```json
{
  "phone": "+375291234567",
  "code4": "1234",
  "purpose": "BUSINESS_PHONE_VERIFY"
}
```

Logic:
- Auth required
- Normalize phone to E.164
- Fetch OTP from database
- Check expiration → delete if expired
- Check attempts (max 3) → delete if exceeded
- Hash input code and compare using timing-safe comparison
- If mismatch → increment attempts, return remaining
- If match → transaction:
  - Update user: `phoneE164`, `phoneVerifiedAt`
  - Update business: `phone`, `status=PENDING_VERIFICATION`
  - Delete OTP record
- Return: `{ ok: true, message: "Телефон подтвержден" }`

### D) Frontend Updates

**PhoneOtpVerify Component:**
- Changed API payload: `phone` instead of `phoneE164`
- Resend button with 60-second countdown
- Error handling for cooldown messages
- No localStorage for OTP codes

## Security Features

1. **HMAC-SHA256 Hashing:** OTP codes never stored in plain text
2. **Timing-Safe Comparison:** Prevents timing attacks
3. **Rate Limiting:** 60-second cooldown between sends
4. **Attempt Limiting:** Max 3 verification attempts
5. **Expiration:** 10-minute TTL for OTP codes
6. **Cascade Delete:** OTPs deleted when user is deleted

## Environment Variables

Required in `.env.local`:
- `OTP_SECRET` - Secret key for HMAC hashing (already configured)
- `SMS_BY_TOKEN` - SMS.BY API token (already configured)

## Database Schema

Table: `PhoneOtp`
- Primary key: `id` (cuid)
- Unique constraint: `(userId, phoneE164, purpose)`
- Indexes: `(userId, purpose)`, `(phoneE164, purpose)`
- Foreign key: `userId` → `User.id` (CASCADE)

## Files Created

- `src/lib/phone/phoneNormalize.ts` - Phone normalization
- `src/lib/otp/otp.ts` - OTP generation and hashing
- `src/lib/sms/smsBy.ts` - SMS.BY client
- `prisma/migrations/20260302230552_add_phone_otp/` - Migration

## Files Modified

- `prisma/schema.prisma` - Added PhoneOtp model
- `src/app/api/phone/start/route.ts` - Database-backed OTP generation
- `src/app/api/phone/verify/route.ts` - Database-backed verification
- `src/components/phone/PhoneOtpVerify.tsx` - Updated API payload format

## Testing Checklist

✅ Prisma migration applied
✅ Prisma client generated with PhoneOtp model
✅ Phone normalization helper created
✅ OTP hashing utilities created
✅ SMS.BY client with alphaname_id=4720
✅ /api/phone/start uses database
✅ /api/phone/verify uses database
✅ Frontend updated for new API format
✅ No TypeScript errors (after Prisma regeneration)

## Manual Testing Required

1. Start dev server: `pnpm dev`
2. Navigate to `/business/onboarding`
3. Enter phone number
4. Click "Получить код" → Verify SMS received
5. Try clicking resend immediately → See cooldown message
6. Wait 60 seconds → Click resend → Verify new SMS
7. Enter wrong code 3 times → Verify lockout
8. Request new code → Enter correct code → Verify success
9. Restart server → Verify OTP still valid (not lost)

## Production Considerations

- OTP codes stored as hashes (secure)
- Timing-safe comparison prevents attacks
- Database persistence survives restarts
- Cooldown prevents SMS spam
- Attempt limiting prevents brute force
- Consider adding: IP rate limiting, phone number blacklist

## Notes

- OTP codes are 4 digits (0000-9999)
- SMS message format: `mamaGo.by: код XXXX`
- Resend generates NEW code (can't resend hash)
- Business status changes to PENDING_VERIFICATION on success
- Old in-memory store (`src/lib/otp/store.ts`) can be deleted
