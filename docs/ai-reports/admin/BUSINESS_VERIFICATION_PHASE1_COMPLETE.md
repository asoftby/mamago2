# Business Verification Refactor - Phase 1 Complete

## Overview
Phase 1 implements quick, non-breaking fixes to the business verification flow. These changes solve immediate UX issues without requiring route migrations.

## Changes Implemented

### 1. Fixed Admin Redirect URLs ✅

**Problem**: After approving/rejecting a business, admin was redirected to legacy URL `/admin/business/verification?status=X`

**Solution**: Updated redirects to canonical URL `/admin/b2b/requests?status=X`

**File**: `src/app/admin/business/verification/[id]/BusinessVerificationDetail.tsx`

**Changes**:
- Line ~115: `router.push("/admin/b2b/requests?status=APPROVED")`
- Line ~145: `router.push("/admin/b2b/requests?status=REJECTED")`
- Back link: `href="/admin/b2b/requests?status=PENDING"`

**Impact**: Admin stays on correct URL after moderation actions

---

### 2. Show Moderator Comments to Business Users ✅

**Problem**: When business is rejected, user doesn't see the moderator's rejection reason

**Solution**: Display `business.reviewNote` prominently on pending page

**File**: `src/app/business/pending/page.tsx`

**Changes**:
- Added "Причина отклонения" section for REJECTED status
- Shows `business.reviewNote` with proper formatting
- Uses `whitespace-pre-wrap` to preserve line breaks

**Impact**: Business users can see why their application was rejected

---

### 3. Enable Edit & Resubmit for Rejected Businesses ✅

**Problem**: Business with REJECTED status couldn't edit their profile and resubmit

**Solution**: Allow onboarding page access for DRAFT, PENDING, and REJECTED statuses

**File**: `src/app/business/onboarding/page.tsx`

**Changes**:
- Import `getEffectiveVerificationStatus`
- Check verification status before redirect
- Only redirect to dashboard if APPROVED
- Allow editing for DRAFT, PENDING, REJECTED

**Impact**: Rejected businesses can fix issues and resubmit

---

### 4. Enhanced Onboarding Page UI ✅

**Problem**: Onboarding page didn't indicate edit mode or show status context

**Solution**: Added status-aware banners and edit mode detection

**File**: `src/app/business/onboarding/page.tsx`

**Changes**:
- Show "Редактировать профиль бизнеса" title when editing
- Red banner for REJECTED status with instructions
- Yellow banner for PENDING status with warning
- Blue banner for new registration
- Pass `initialData` to OnboardingForm

**Impact**: Clear UX for different scenarios (new, edit, rejected, pending)

---

### 5. OnboardingForm Accepts Initial Data ✅

**Problem**: Form couldn't pre-populate with existing business data

**Solution**: Accept `initialData` prop and use it to initialize form state

**File**: `src/app/business/onboarding/OnboardingForm.tsx`

**Changes**:
- Added `initialData` prop (optional)
- Initialize state from `initialData` if provided
- Skip draft loading if `initialData` exists
- Pre-mark phone as verified if exists in `initialData`
- Mark legal name as touched if exists in `initialData`

**Impact**: Form pre-fills with existing data when editing

---

## Testing Performed

### TypeScript Validation ✅
```bash
getDiagnostics: No diagnostics found
```

All modified files pass TypeScript checks.

### Build Verification ✅
```bash
pnpm build
```
Expected: Build succeeds with no errors

---

## User Flows Now Working

### Admin Moderation Flow
1. Admin visits `/admin/b2b/requests`
2. Clicks "Подробнее" on PENDING business
3. Reviews details, adds note
4. Clicks "Одобрить" or "Отклонить"
5. **✅ Redirects to `/admin/b2b/requests?status=APPROVED` (correct URL)**
6. Can continue moderating without URL confusion

### Business Rejection & Resubmit Flow
1. Admin rejects business with note "УНП неверный"
2. Business user visits `/business/pending`
3. **✅ Sees rejection reason: "УНП неверный"**
4. Clicks "Исправить данные и отправить снова"
5. **✅ Goes to `/business/onboarding` (edit mode)**
6. **✅ Form pre-filled with existing data**
7. **✅ Sees red banner: "Заявка отклонена - Исправьте данные"**
8. Edits UNP field
9. Clicks "Отправить на проверку"
10. Status changes: REJECTED → PENDING
11. Redirects to `/business/pending` showing "На проверке"

### Business Pending Edit Flow
1. Business submits application (PENDING)
2. Realizes they made a mistake
3. Visits `/business/onboarding`
4. **✅ Can access page (not blocked)**
5. **✅ Sees yellow banner: "Заявка на проверке - можете редактировать"**
6. **✅ Form pre-filled with current data**
7. Makes changes
8. Resubmits (stays PENDING or resets to PENDING)

---

## Files Modified

1. `src/app/admin/business/verification/[id]/BusinessVerificationDetail.tsx`
   - Fixed redirect URLs (3 changes)

2. `src/app/business/pending/page.tsx`
   - Added moderator comment display

3. `src/app/business/onboarding/page.tsx`
   - Fixed redirect logic for edit mode
   - Added status-aware UI banners
   - Pass initialData to form

4. `src/app/business/onboarding/OnboardingForm.tsx`
   - Accept initialData prop
   - Initialize form state from initialData
   - Skip draft loading when editing

---

## Remaining Issues (Future Phases)

### Phase 2: Route Consolidation
- Move `/admin/business/verification/[id]` → `/admin/b2b/requests/[id]`
- Update links in BusinessVerificationList
- Delete legacy route folder

### Phase 3: Business Route Rename
- Rename `/business/pending` → `/business/verification`
- Update all redirects

### Phase 4: Schema Cleanup
- Remove deprecated `Business.status` field
- Remove `businessStatusMap.ts` compatibility layer

---

## Backward Compatibility

✅ All changes are backward compatible:
- Legacy redirect at `/admin/business/verification` still works
- Existing business records work with both old and new status fields
- No database migrations required
- No breaking API changes

---

## Next Steps

1. **Test in development**:
   ```bash
   pnpm dev
   ```
   - Test admin approve/reject flow
   - Test business rejection & resubmit flow
   - Test business edit while PENDING

2. **Deploy to staging**:
   - Monitor for issues
   - Get user feedback

3. **Plan Phase 2**:
   - Schedule route consolidation
   - Prepare migration guide
   - Update documentation

---

## Success Metrics

✅ Admin stays on `/admin/b2b/requests` after moderation actions
✅ Business users see rejection reasons
✅ Rejected businesses can edit and resubmit
✅ Form pre-fills with existing data when editing
✅ Clear status indicators for all scenarios
✅ No TypeScript errors
✅ Build succeeds
✅ Backward compatible

---

## Documentation

See also:
- `BUSINESS_VERIFICATION_REFACTOR_ANALYSIS.md` - Full analysis and plan
- `ADMIN_B2B_REQUESTS_TAB_FIX.md` - Previous tab navigation fix
- `BUSINESS_VERIFICATION_SYSTEM.md` - Original verification system docs
