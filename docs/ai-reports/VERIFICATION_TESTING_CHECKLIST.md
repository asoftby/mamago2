# Business Verification - Testing Checklist

## Pre-Deployment Checks

### Build & TypeScript
- [x] `pnpm build` succeeds
- [x] No TypeScript errors
- [x] No linting errors
- [x] All routes registered correctly

---

## Admin Flow Testing

### 1. Admin Access Control
- [ ] Non-admin user cannot access `/admin/b2b/requests`
- [ ] Non-admin redirected to home page
- [ ] Admin user can access `/admin/b2b/requests`
- [ ] Moderator user can access `/admin/b2b/requests`

### 2. Business List - Tab Navigation
- [ ] Visit `/admin/b2b/requests` - shows PENDING tab by default
- [ ] Click "Одобрено" tab - URL changes to `?status=APPROVED`
- [ ] Click "Отклонено" tab - URL changes to `?status=REJECTED`
- [ ] Click "Черновик" tab - URL changes to `?status=DRAFT`
- [ ] Click "На проверке" tab - URL changes to `?status=PENDING`
- [ ] URL stays on `/admin/b2b/requests` (path doesn't change)
- [ ] No full page reload when switching tabs
- [ ] Active tab highlighted correctly
- [ ] Business list updates based on selected status

### 3. Business List - Display
- [ ] Shows correct businesses for each status
- [ ] Empty state shows when no businesses
- [ ] Table shows: Name, Owner, UNП, Status, Submit Date, Actions
- [ ] Status badges colored correctly (yellow=PENDING, green=APPROVED, red=REJECTED, gray=DRAFT)
- [ ] "Подробнее" link works

### 4. Business Detail Page
- [ ] Click "Подробнее" opens detail page
- [ ] Shows business information correctly
- [ ] Shows owner information correctly
- [ ] Shows verification status
- [ ] Shows submit date if exists
- [ ] Shows review note if exists
- [ ] Shows verification history logs
- [ ] Back link goes to `/admin/b2b/requests?status=PENDING`

### 5. Approve Flow
- [ ] Detail page shows moderation panel for PENDING business
- [ ] Can enter optional note
- [ ] Click "Одобрить" shows confirmation
- [ ] After approve, redirects to `/admin/b2b/requests?status=APPROVED`
- [ ] Approved business appears in APPROVED tab
- [ ] Business no longer in PENDING tab
- [ ] Verification log created with correct data

### 6. Reject Flow
- [ ] Detail page shows moderation panel for PENDING business
- [ ] Can enter rejection note (required)
- [ ] Click "Отклонить" without note shows error
- [ ] Click "Отклонить" with note shows confirmation
- [ ] After reject, redirects to `/admin/b2b/requests?status=REJECTED`
- [ ] Rejected business appears in REJECTED tab
- [ ] Business no longer in PENDING tab
- [ ] Verification log created with note

### 7. Non-Pending Business Detail
- [ ] APPROVED business detail doesn't show moderation panel
- [ ] REJECTED business detail doesn't show moderation panel
- [ ] DRAFT business detail doesn't show moderation panel
- [ ] Can still view all information

### 8. Legacy URL Redirect
- [ ] Visit `/admin/business/verification` redirects to `/admin/b2b/requests`
- [ ] Visit `/admin/business/verification?status=APPROVED` redirects to `/admin/b2b/requests?status=APPROVED`
- [ ] Status parameter preserved in redirect

---

## Business User Flow Testing

### 1. New Registration
- [ ] Register new user account
- [ ] Visit `/business/onboarding` - shows create form
- [ ] Form shows "Welcome to Business Cabinet" title
- [ ] Form shows blue banner "Create Your Business"
- [ ] Form fields empty (no pre-fill)
- [ ] Enter УНП (9 digits)
- [ ] Legal name auto-fills after УНП lookup (if found)
- [ ] Enter phone number
- [ ] Verify phone with OTP
- [ ] Submit button enabled after phone verified
- [ ] Click "Отправить на проверку"
- [ ] Business created with DRAFT status
- [ ] Status changes to PENDING
- [ ] Redirects to `/business/pending`

### 2. Pending Status Page
- [ ] Shows "На проверке" heading
- [ ] Shows yellow icon
- [ ] Shows "Ваша заявка отправлена на модерацию"
- [ ] Shows "Что дальше?" section with 3 steps
- [ ] Shows business data summary
- [ ] Shows status as "На проверке"
- [ ] Shows support email link
- [ ] Try to visit `/business/dashboard` - redirects back to pending
- [ ] Try to visit `/business/places` - redirects back to pending
- [ ] Try to visit `/business/offers` - redirects back to pending

### 3. Approval Flow
- [ ] Admin approves business
- [ ] Business user visits `/business/pending`
- [ ] Automatically redirects to `/business/dashboard`
- [ ] Dashboard accessible
- [ ] Can access `/business/places`
- [ ] Can access `/business/offers`
- [ ] Cannot access `/business/onboarding` (redirects to dashboard)

### 4. Rejection Flow
- [ ] Admin rejects business with note "УНП неверный"
- [ ] Business user visits `/business/pending`
- [ ] Shows "Заявка отклонена" heading
- [ ] Shows red icon
- [ ] Shows "Причина отклонения" section
- [ ] Displays rejection note: "УНП неверный"
- [ ] Shows "Что делать?" section
- [ ] Shows "Исправить данные и отправить снова" button
- [ ] Try to visit `/business/dashboard` - redirects back to pending

### 5. Edit & Resubmit Flow (REJECTED)
- [ ] Business has REJECTED status
- [ ] Visit `/business/pending`
- [ ] Click "Исправить данные и отправить снова"
- [ ] Goes to `/business/onboarding`
- [ ] Shows "Редактировать профиль бизнеса" title
- [ ] Shows red banner "Заявка отклонена - Исправьте данные"
- [ ] Form pre-filled with existing УНП
- [ ] Form pre-filled with existing legal name
- [ ] Form pre-filled with existing phone
- [ ] Phone marked as verified (no need to re-verify)
- [ ] Can edit УНП field
- [ ] Can edit legal name field
- [ ] Submit button enabled
- [ ] Click "Отправить на проверку"
- [ ] Status changes: REJECTED → PENDING
- [ ] Redirects to `/business/pending`
- [ ] Shows "На проверке" status

### 6. Edit While Pending
- [ ] Business has PENDING status
- [ ] Visit `/business/onboarding`
- [ ] Shows "Редактировать профиль бизнеса" title
- [ ] Shows yellow banner "Заявка на проверке - можете редактировать"
- [ ] Form pre-filled with existing data
- [ ] Can make changes
- [ ] Can resubmit (stays PENDING or resets to PENDING)

### 7. Draft Status
- [ ] Business has DRAFT status (not submitted yet)
- [ ] Visit `/business/pending`
- [ ] Shows "Завершите профиль" heading
- [ ] Shows blue icon
- [ ] Shows "Заполните все поля и отправьте заявку"
- [ ] Shows "Перейти к заполнению профиля" button
- [ ] Click button goes to `/business/onboarding`
- [ ] Can complete and submit

---

## Edge Cases

### 1. No Business Yet
- [ ] User logged in but no business
- [ ] Visit `/business/dashboard` - redirects to `/business/onboarding`
- [ ] Visit `/business/places` - redirects to `/business/onboarding`
- [ ] Visit `/business/offers` - redirects to `/business/onboarding`
- [ ] Visit `/business/pending` - redirects to `/business/onboarding`

### 2. Not Logged In
- [ ] Visit `/business/onboarding` - redirects to `/register?from=business`
- [ ] Visit `/business/pending` - redirects to `/login?from=business`
- [ ] Visit `/business/dashboard` - redirects to `/login?from=business`
- [ ] Visit `/admin/b2b/requests` - redirects to `/login`

### 3. Multiple Status Changes
- [ ] Business: DRAFT → PENDING → REJECTED → PENDING → APPROVED
- [ ] Each transition creates verification log
- [ ] Logs show correct statusFrom and statusTo
- [ ] Logs show reviewer email
- [ ] Logs show notes
- [ ] Timestamps correct

### 4. Phone Verification
- [ ] Cannot submit without phone verification
- [ ] Phone verification persists when editing
- [ ] Don't need to re-verify phone when resubmitting
- [ ] Phone stored in E.164 format

### 5. УНП Lookup
- [ ] Valid УНП auto-fills legal name
- [ ] Invalid УНП shows soft error (doesn't block)
- [ ] Can manually enter legal name if lookup fails
- [ ] Lookup debounced (doesn't fire on every keystroke)

---

## Data Integrity

### 1. Database Fields
- [ ] `Business.verificationStatus` set correctly
- [ ] `Business.submittedAt` set when submitted
- [ ] `Business.reviewedAt` set when approved/rejected
- [ ] `Business.reviewedByUserId` set to admin user ID
- [ ] `Business.reviewNote` saved correctly
- [ ] `Business.approvedAt` set when approved
- [ ] `Business.rejectedAt` set when rejected

### 2. Verification Logs
- [ ] Log created on DRAFT → PENDING
- [ ] Log created on PENDING → APPROVED
- [ ] Log created on PENDING → REJECTED
- [ ] Log created on REJECTED → PENDING
- [ ] Log includes statusFrom and statusTo
- [ ] Log includes note if provided
- [ ] Log includes reviewedByUserId if admin action
- [ ] Log includes createdAt timestamp

### 3. Status Consistency
- [ ] Only one business per user (ownerUserId unique)
- [ ] Status transitions follow state machine
- [ ] Cannot approve from DRAFT
- [ ] Cannot reject from DRAFT
- [ ] Cannot approve from APPROVED
- [ ] Cannot reject from REJECTED

---

## Performance

### 1. Page Load Times
- [ ] Admin list page loads in < 2s
- [ ] Business detail page loads in < 2s
- [ ] Business pending page loads in < 2s
- [ ] Onboarding page loads in < 2s

### 2. API Response Times
- [ ] GET `/api/admin/business-verification` < 500ms
- [ ] GET `/api/admin/business-verification/[id]` < 500ms
- [ ] POST `/api/admin/business-verification/[id]/approve` < 1s
- [ ] POST `/api/admin/business-verification/[id]/reject` < 1s

### 3. Database Queries
- [ ] No N+1 queries
- [ ] Proper indexes used
- [ ] Includes optimized (only fetch needed fields)

---

## Security

### 1. Authorization
- [ ] Non-admin cannot approve businesses
- [ ] Non-admin cannot reject businesses
- [ ] Non-admin cannot access admin APIs
- [ ] Business owner can only edit their own business
- [ ] Business owner cannot change status directly

### 2. Input Validation
- [ ] УНП must be 9 digits
- [ ] Legal name required
- [ ] Phone must be valid E.164
- [ ] Rejection note required when rejecting
- [ ] XSS protection on all text inputs

### 3. CSRF Protection
- [ ] All POST requests protected
- [ ] Form submissions use proper tokens

---

## Browser Compatibility

### Desktop
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Responsive layout works

---

## Accessibility

### 1. Keyboard Navigation
- [ ] Can tab through all form fields
- [ ] Can submit forms with Enter
- [ ] Can navigate tabs with keyboard
- [ ] Focus indicators visible

### 2. Screen Readers
- [ ] Form labels properly associated
- [ ] Status messages announced
- [ ] Error messages announced
- [ ] Button purposes clear

### 3. Color Contrast
- [ ] Status badges readable
- [ ] Error messages readable
- [ ] All text meets WCAG AA

---

## Monitoring

### 1. Error Tracking
- [ ] Failed approvals logged
- [ ] Failed rejections logged
- [ ] Failed submissions logged
- [ ] API errors tracked

### 2. Analytics
- [ ] Track approval rate
- [ ] Track rejection rate
- [ ] Track time to approval
- [ ] Track resubmission rate

---

## Rollback Plan

### If Issues Found
1. [ ] Identify affected files
2. [ ] Revert commits
3. [ ] Verify build succeeds
4. [ ] Deploy rollback
5. [ ] Monitor for stability

### Rollback Files
- `src/app/admin/business/verification/[id]/BusinessVerificationDetail.tsx`
- `src/app/business/pending/page.tsx`
- `src/app/business/onboarding/page.tsx`
- `src/app/business/onboarding/OnboardingForm.tsx`

---

## Sign-Off

### Development
- [ ] All code changes reviewed
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Signed off by: _______________

### QA
- [ ] All test cases executed
- [ ] No critical bugs found
- [ ] Performance acceptable
- [ ] Signed off by: _______________

### Product
- [ ] User flows validated
- [ ] UX approved
- [ ] Copy approved
- [ ] Signed off by: _______________

### DevOps
- [ ] Deployment plan reviewed
- [ ] Rollback plan tested
- [ ] Monitoring configured
- [ ] Signed off by: _______________

---

## Post-Deployment

### Immediate (0-24 hours)
- [ ] Monitor error rates
- [ ] Check user feedback
- [ ] Verify key flows working
- [ ] No rollback needed

### Short-term (1-7 days)
- [ ] Analyze usage patterns
- [ ] Collect user feedback
- [ ] Identify improvements
- [ ] Plan Phase 2 if needed

### Long-term (1-4 weeks)
- [ ] Measure success metrics
- [ ] Document lessons learned
- [ ] Plan future enhancements
- [ ] Archive old code
