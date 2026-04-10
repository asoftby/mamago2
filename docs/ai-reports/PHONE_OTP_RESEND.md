# Phone OTP Resend Implementation

## Status: ✅ COMPLETE

## Summary

Implemented SMS resend logic with 60-second cooldown for OTP verification flow.

## Backend Changes

### 1. Updated OTP Store Structure (`src/lib/otp/store.ts`)
Added `lastSentAt` field to track when OTP was last sent:
```typescript
interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number; // NEW
}
```

### 2. Updated `/api/phone/start` Route
Implemented resend logic with cooldown:

- **First request**: Generate new 4-digit OTP, send SMS, store with `lastSentAt`
- **Resend request (within 60 sec)**: Return error with countdown
  - Response: `{ ok: false, error: "Повторная отправка через X сек." }`
  - HTTP 429 status
- **Resend request (after 60 sec)**: Resend same OTP code
  - Update `lastSentAt` timestamp
  - Response: `{ ok: true, resent: true, sms_id, status }`
- **Expired OTP**: Delete and generate new code

Constants:
- `OTP_EXPIRY_MS = 5 * 60 * 1000` (5 minutes)
- `RESEND_COOLDOWN_SEC = 60` (60 seconds)

## Frontend Changes

### 3. Updated `PhoneOtpVerify` Component

Added resend functionality:
- New state: `resendCooldown` (tracks remaining seconds)
- Countdown timer using `useEffect` with 1-second interval
- Resend button in "code-sent" step:
  - Disabled during cooldown
  - Shows countdown: "Отправить повторно (X)"
  - Enabled after 60 seconds: "Отправить повторно"
  - Calls same `/api/phone/start` endpoint
- Layout: "Изменить номер" (left) | "Отправить повторно" (right)

## User Flow

1. User clicks "Получить код" → SMS sent, 60-second cooldown starts
2. User clicks "Отправить повторно" before 60 sec → Error message shown
3. After 60 seconds → "Отправить повторно" button enabled
4. User clicks resend → Same OTP code sent again, cooldown resets
5. User can resend multiple times (every 60 seconds)

## Technical Details

- No duplicate OTP generation on resend
- Same code valid for 5 minutes total
- Cooldown calculated server-side (secure)
- Frontend countdown for UX only
- HTTP 429 status for rate limiting
- Cooldown resets on each successful send

## Files Modified

- `src/lib/otp/store.ts` - Added `lastSentAt` field
- `src/app/api/phone/start/route.ts` - Implemented resend logic with cooldown
- `src/components/phone/PhoneOtpVerify.tsx` - Added resend button with countdown

## Testing Checklist

✅ TypeScript compilation passes
✅ No diagnostic errors
✅ Backend validates cooldown
✅ Frontend shows countdown timer
✅ Resend button disabled during cooldown
✅ Same OTP code sent on resend

## Manual Testing

1. Enter phone number and click "Получить код"
2. Verify SMS received with 4-digit code
3. Click "Отправить повторно" immediately → See countdown
4. Wait for countdown to reach 0
5. Click "Отправить повторно" → Verify same code sent
6. Enter code and verify → Success

## Security Notes

- Cooldown enforced server-side (cannot be bypassed)
- OTP expires after 5 minutes regardless of resends
- Rate limiting prevents SMS spam
- Same code reused (no new code generation on resend)
