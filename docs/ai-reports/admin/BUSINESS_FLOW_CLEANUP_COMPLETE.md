# Business Flow Cleanup - Complete ✅

## Goal
Remove UX "каша" by enforcing clear routing:
- **DRAFT/REJECTED** → `/business/onboarding` (edit form)
- **PENDING** → `/business/verification` (status + comments)
- **APPROVED** → `/business/dashboard`

## Changes Implemented

### 1. `/business/onboarding/page.tsx`
- ✅ Added redirect to `/business/verification` if status === PENDING
- ✅ Removed PENDING info banner (no longer renders)
- ✅ Removed "Current User" dev block from UI
- ✅ Pass `isPhoneVerifiedInitial={!!user.phoneVerifiedAt}` to form

### 2. `/business/onboarding/OnboardingForm.tsx`
- ✅ Added `isPhoneVerifiedInitial` prop
- ✅ Initialize `isPhoneVerified` from prop (not from `initialData.phone`)
- ✅ Show green badge "✅ Номер телефона подтвержден" when verified
- ✅ Hide `<PhoneOtpVerify/>` when verified
- ✅ Submit button remains disabled until phone verified

### 3. `/business/verification/page.tsx`
- ✅ Added redirect to `/business/onboarding` if status === DRAFT
- ✅ Removed DRAFT UI section ("Завершите профиль…")
- ✅ Keep PENDING and REJECTED UI
- ✅ Keep moderator comment block for REJECTED

### 4. `/business/pending/page.tsx`
- ✅ Already redirects to `/business/verification` (backward compatibility)

## Flow Diagram

```
User visits /business/onboarding
├─ No business → Render form
├─ DRAFT → Render form (can edit)
├─ REJECTED → Render form (can fix & resubmit)
├─ PENDING → Redirect to /business/verification
└─ APPROVED → Redirect to /business/dashboard

User visits /business/verification
├─ No business → Redirect to /business/onboarding
├─ DRAFT → Redirect to /business/onboarding
├─ PENDING → Show "На проверке" status
├─ REJECTED → Show rejection reason + "Исправить данные"
└─ APPROVED → Redirect to /business/dashboard
```

## Phone Verification Source of Truth

**Before:** `isPhoneVerified` initialized from `!!initialData?.phone` (unreliable)

**After:** `isPhoneVerified` initialized from `isPhoneVerifiedInitial` prop, which comes from `!!user.phoneVerifiedAt` (database truth)

## UI Improvements

1. **Onboarding page** - Cleaner, no dev blocks, no confusing PENDING banner
2. **Phone verification badge** - Clear visual feedback when phone is verified
3. **Verification page** - Only shows PENDING/REJECTED states, no DRAFT confusion
4. **Clear CTAs** - Each status has appropriate action button

## Testing Checklist

- [ ] DRAFT business → can access onboarding, cannot access verification
- [ ] PENDING business → redirected from onboarding to verification
- [ ] REJECTED business → can access onboarding with rejection message
- [ ] APPROVED business → redirected to dashboard from both pages
- [ ] Phone verified users see green badge, no OTP input
- [ ] Phone unverified users see OTP verification flow
- [ ] Submit button disabled until phone verified

## Files Modified
- `src/app/business/onboarding/page.tsx`
- `src/app/business/onboarding/OnboardingForm.tsx`
- `src/app/business/verification/page.tsx`

## Status
✅ Complete - All requirements implemented, no diagnostics errors
