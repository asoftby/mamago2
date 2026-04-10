# Business Phone Verification Implementation

## Overview
Implemented phone verification with OTP (One-Time Password) for business onboarding. Users must verify their phone number before submitting their business application.

## Features

### 1. Phone Input with BY Mask
- **Component**: `src/components/phone/PhoneInputByMask.tsx`
- Default value: `+375` (Belarus country code)
- E.164 format normalization (e.g., `+375291234567`)
- Smart formatting:
  - Belarus numbers: `+375 (29) 123-45-67`
  - Other countries: `+` + digits (no mask)
- Leading `+` cannot be deleted
- User can change country code by editing digits after `+`

### 2. OTP Verification
- **Component**: `src/components/phone/PhoneOtpVerify.tsx`
- "Получить код" button to request OTP
- 4-digit code input with auto-advance
- "Подтвердить" button to verify code
- Success state: "Номер подтвержден" badge
- Error handling with retry limits (max 3 attempts)

### 3. API Endpoints

#### POST /api/phone/start
- **Purpose**: Send OTP code to phone
- **Body**: `{ phoneE164, purpose: "BUSINESS_PHONE_VERIFY" }`
- **Features**:
  - Generates 4-digit code
  - 5-minute expiration
  - In-memory storage (MVP - use Redis in production)
  - Checks for duplicate phone numbers
  - SMS.BY integration ready (commented out for dev)
  - Dev mode: logs code to console

#### POST /api/phone/verify
- **Purpose**: Verify OTP code
- **Body**: `{ phoneE164, code4, purpose: "BUSINESS_PHONE_VERIFY" }`
- **Features**:
  - Validates code
  - Max 3 attempts per code
  - Updates User.phoneE164 and User.phoneVerifiedAt
  - Updates Business.status to PENDING_VERIFICATION
  - Atomic transaction for data consistency

### 4. Database Schema Updates

#### User Model
```prisma
model User {
  phoneE164       String?   @unique
  phoneVerifiedAt DateTime?
  // ... other fields
}
```

#### BusinessStatus Enum
```prisma
enum BusinessStatus {
  DRAFT
  PENDING_VERIFICATION  // NEW: After phone verification
  PENDING_REVIEW        // After form submission
  APPROVED
  REJECTED
}
```

### 5. Business Onboarding Flow

1. User fills in business details (name, UNP, legal name)
2. User enters phone number with BY mask
3. User clicks "Получить код" → OTP sent via SMS
4. User enters 4-digit code
5. System verifies code → phone locked, success badge shown
6. User clicks "Отправить на проверку" (enabled only after verification)
7. Business created with status `PENDING_VERIFICATION`
8. User redirected to `/business/pending` page

### 6. Updated Pages

#### Onboarding Form
- **File**: `src/app/business/onboarding/OnboardingForm.tsx`
- Integrated PhoneInputByMask and PhoneOtpVerify
- Submit button disabled until phone verified
- Shows warning message if phone not verified

#### Pending Page
- **File**: `src/app/business/pending/page.tsx`
- Added support for `PENDING_VERIFICATION` status
- Blue color scheme for pending verification
- Yellow for pending review
- Red for rejected

#### Server Actions
- **File**: `src/app/business/onboarding/actions.ts`
- Validates phone is verified before creating business
- Checks phoneE164 matches verified phone
- Creates business with `PENDING_VERIFICATION` status

## Security Features

1. **Phone Uniqueness**: One phone per user account
2. **Verification Required**: Cannot submit form without verified phone
3. **Rate Limiting**: Max 3 attempts per OTP code
4. **Expiration**: OTP codes expire after 5 minutes
5. **E.164 Validation**: Server-side format validation
6. **Atomic Updates**: Transaction ensures data consistency

## Development Testing

### Console Logging (Development Only)
When `NODE_ENV=development`, OTP codes are logged to console:
```
[OTP] Phone: +375291234567, Code: 1234
```

### Test Flow
1. Start dev server: `pnpm dev`
2. Navigate to `/business/onboarding`
3. Fill in business details
4. Enter phone: `+375 29 123 45 67`
5. Click "Получить код"
6. Check console for OTP code
7. Enter code in 4-digit input
8. Click "Подтвердить"
9. See success badge
10. Submit form

## Production Deployment

### SMS.BY Integration
Uncomment the SMS sending code in `src/app/api/phone/start/route.ts`:

```typescript
const smsResponse = await fetch("https://app.sms.by/api/v1/sendQuickSMS", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    token: process.env.SMS_BY_TOKEN,
    phone: phoneE164,
    message: `Ваш код подтверждения: ${code4}`,
    alphaname: "mamaGo",
  }),
});
```

### Environment Variables
Add to `.env`:
```
SMS_BY_TOKEN=your_sms_by_api_token
```

### OTP Storage
For production, replace in-memory Map with Redis:
- Install: `pnpm add ioredis`
- Update `src/lib/otp/store.ts` to use Redis
- Set expiration with `SETEX` command

## Files Created/Modified

### Created
- `src/components/phone/PhoneInputByMask.tsx`
- `src/components/phone/PhoneOtpVerify.tsx`
- `src/app/api/phone/start/route.ts`
- `src/app/api/phone/verify/route.ts`
- `src/lib/otp/store.ts`
- `prisma/migrations/20260302203254_add_phone_verification/migration.sql`

### Modified
- `prisma/schema.prisma` - Added phone fields to User, PENDING_VERIFICATION to BusinessStatus
- `src/app/business/onboarding/OnboardingForm.tsx` - Integrated phone verification
- `src/app/business/onboarding/actions.ts` - Added phone verification checks
- `src/app/business/pending/page.tsx` - Added PENDING_VERIFICATION status handling

## Migration
```bash
pnpm prisma migrate dev --name add_phone_verification
```

## Build Status
✅ Build successful
✅ No TypeScript errors
✅ All routes compiled
