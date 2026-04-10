# Business Verification Flow - Visual Diagrams

## Status State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS VERIFICATION STATES                  │
└─────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  DRAFT  │  ← Initial state when business created
    └────┬────┘
         │
         │ submitForVerification()
         │ (Business user clicks "Submit for Review")
         ↓
    ┌─────────┐
    │ PENDING │  ← Under admin review
    └────┬────┘
         │
         ├──────────────────────┬──────────────────────┐
         │                      │                      │
         │ approve()            │ reject()             │
         │ (Admin)              │ (Admin + note)       │
         ↓                      ↓                      │
    ┌──────────┐          ┌──────────┐               │
    │ APPROVED │          │ REJECTED │               │
    └──────────┘          └────┬─────┘               │
         │                     │                      │
         │                     │ submitForVerification()
         │                     │ (Business fixes & resubmits)
         │                     └──────────────────────┘
         │
         └─→ Can access dashboard, create places/offers
```

---

## Admin Moderation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN MODERATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

1. Admin visits /admin/b2b/requests
   ┌────────────────────────────────────────────────────┐
   │  Заявки на верификацию                             │
   │  ┌──────────┬──────────┬──────────┬──────────┐   │
   │  │ PENDING  │ APPROVED │ REJECTED │  DRAFT   │   │
   │  └──────────┴──────────┴──────────┴──────────┘   │
   │                                                    │
   │  Business List (filtered by status)               │
   │  ┌────────────────────────────────────────────┐  │
   │  │ Name    │ Owner  │ UNP │ Status │ Actions │  │
   │  │ Радуга  │ user@  │ 123 │ PENDING│ [View]  │  │
   │  └────────────────────────────────────────────┘  │
   └────────────────────────────────────────────────────┘

2. Admin clicks "View" → /admin/business/verification/[id]
   ┌────────────────────────────────────────────────────┐
   │  ← Back to list                                    │
   │  Детский центр "Радуга"                            │
   │  Status: На проверке                               │
   │                                                    │
   │  Business Info:                                    │
   │  - Legal Name: ООО "Радуга"                        │
   │  - UNП: 123456789                                  │
   │  - Phone: +375291234567                            │
   │                                                    │
   │  Owner Info:                                       │
   │  - Email: owner@example.com                        │
   │  - Phone: +375291234567                            │
   │                                                    │
   │  Moderation:                                       │
   │  ┌──────────────────────────────────────────────┐ │
   │  │ Note: [Optional comment]                     │ │
   │  │ [Одобрить]  [Отклонить]                      │ │
   │  └──────────────────────────────────────────────┘ │
   └────────────────────────────────────────────────────┘

3. Admin clicks "Одобрить"
   ✅ Status changes: PENDING → APPROVED
   ✅ Redirects to: /admin/b2b/requests?status=APPROVED
   ✅ Shows approved businesses list

4. Admin clicks "Отклонить" (with note)
   ✅ Status changes: PENDING → REJECTED
   ✅ Redirects to: /admin/b2b/requests?status=REJECTED
   ✅ Shows rejected businesses list
```

---

## Business User Flow - New Registration

```
┌─────────────────────────────────────────────────────────────────┐
│                   NEW BUSINESS REGISTRATION                      │
└─────────────────────────────────────────────────────────────────┘

1. User registers account → /register
   ✅ Creates User account

2. User visits /business/onboarding
   ┌────────────────────────────────────────────────────┐
   │  Welcome to Business Cabinet                       │
   │                                                    │
   │  Create Your Business                              │
   │  Let's start by creating your business profile     │
   │                                                    │
   │  ┌──────────────────────────────────────────────┐ │
   │  │ УНП: [_________]                             │ │
   │  │ Legal Name: [_________________________]      │ │
   │  │ Phone: [+375__________]                      │ │
   │  │ [Verify Phone]                               │ │
   │  │                                              │ │
   │  │ [Отправить на проверку]                      │ │
   │  └──────────────────────────────────────────────┘ │
   └────────────────────────────────────────────────────┘

3. User submits form
   ✅ Creates Business with status: DRAFT
   ✅ Changes status: DRAFT → PENDING
   ✅ Redirects to: /business/pending

4. User sees pending page
   ┌────────────────────────────────────────────────────┐
   │  🕐 На проверке                                    │
   │  Ваша заявка отправлена на модерацию              │
   │                                                    │
   │  Что дальше?                                       │
   │  ✓ Модератор проверит данные                       │
   │  ✓ Проверка занимает 1-2 рабочих дня              │
   │  ✓ Вы получите уведомление на email               │
   │                                                    │
   │  Данные вашей заявки:                              │
   │  - Название: Детский центр "Радуга"                │
   │  - УНП: 123456789                                  │
   │  - Статус: На проверке                             │
   └────────────────────────────────────────────────────┘

5. User tries to access /business/dashboard
   ❌ Blocked by guard
   ✅ Redirects to: /business/pending
```

---

## Business User Flow - Rejection & Resubmit

```
┌─────────────────────────────────────────────────────────────────┐
│                  REJECTION & RESUBMIT FLOW                       │
└─────────────────────────────────────────────────────────────────┘

1. Admin rejects with note "УНП неверный, проверьте данные"
   ✅ Status changes: PENDING → REJECTED
   ✅ reviewNote saved to database

2. Business user visits /business/pending
   ┌────────────────────────────────────────────────────┐
   │  ❌ Заявка отклонена                               │
   │  К сожалению, ваша заявка не прошла проверку      │
   │                                                    │
   │  ┌──────────────────────────────────────────────┐ │
   │  │ Причина отклонения:                          │ │
   │  │ УНП неверный, проверьте данные               │ │
   │  └──────────────────────────────────────────────┘ │
   │                                                    │
   │  Что делать?                                       │
   │  Пожалуйста, проверьте данные и отправьте         │
   │  заявку повторно                                   │
   │                                                    │
   │  [Исправить данные и отправить снова]             │
   └────────────────────────────────────────────────────┘

3. User clicks "Исправить данные"
   ✅ Goes to: /business/onboarding

4. User sees onboarding page (edit mode)
   ┌────────────────────────────────────────────────────┐
   │  Редактировать профиль бизнеса                     │
   │                                                    │
   │  ┌──────────────────────────────────────────────┐ │
   │  │ ⚠️ Заявка отклонена                           │ │
   │  │ Исправьте данные ниже и отправьте повторно   │ │
   │  └──────────────────────────────────────────────┘ │
   │                                                    │
   │  ┌──────────────────────────────────────────────┐ │
   │  │ УНП: [123456789] ← Pre-filled                │ │
   │  │ Legal Name: [ООО "Радуга"] ← Pre-filled      │ │
   │  │ Phone: [+375291234567] ← Pre-filled          │ │
   │  │ ✓ Phone verified                             │ │
   │  │                                              │ │
   │  │ [Отправить на проверку]                      │ │
   │  └──────────────────────────────────────────────┘ │
   └────────────────────────────────────────────────────┘

5. User fixes УНП and resubmits
   ✅ Status changes: REJECTED → PENDING
   ✅ Redirects to: /business/pending
   ✅ Shows "На проверке" again

6. Admin reviews again
   ✅ Can see verification history
   ✅ Can approve or reject again
```

---

## Business User Flow - Approval

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPROVAL FLOW                               │
└─────────────────────────────────────────────────────────────────┘

1. Admin approves business
   ✅ Status changes: PENDING → APPROVED
   ✅ approvedAt timestamp set

2. Business user visits /business/pending
   ✅ Guard detects APPROVED status
   ✅ Redirects to: /business/dashboard

3. User sees dashboard
   ┌────────────────────────────────────────────────────┐
   │  Business Cabinet                                  │
   │  [Dashboard] [Places] [Offers]                     │
   │                                                    │
   │  Welcome to your business dashboard!               │
   │                                                    │
   │  Quick Stats:                                      │
   │  - Places: 0                                       │
   │  - Offers: 0                                       │
   │  - Views: 0                                        │
   │                                                    │
   │  [Create Your First Place]                         │
   └────────────────────────────────────────────────────┘

4. User can now:
   ✅ Access /business/dashboard
   ✅ Access /business/places
   ✅ Access /business/offers
   ✅ Create places and offers
   ✅ Publish content
```

---

## Route Protection Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTE PROTECTION MATRIX                       │
└─────────────────────────────────────────────────────────────────┘

Route                          │ DRAFT │ PENDING │ REJECTED │ APPROVED
───────────────────────────────┼───────┼─────────┼──────────┼─────────
/business/onboarding           │  ✅   │   ✅    │    ✅    │    ❌
/business/pending              │  ✅   │   ✅    │    ✅    │    ❌
/business/dashboard            │  ❌   │   ❌    │    ❌    │    ✅
/business/places               │  ❌   │   ❌    │    ❌    │    ✅
/business/offers               │  ❌   │   ❌    │    ❌    │    ✅

Legend:
✅ = Accessible
❌ = Blocked (redirects to appropriate page)

Redirect Rules:
- DRAFT/PENDING/REJECTED trying to access dashboard → /business/pending
- APPROVED trying to access onboarding → /business/dashboard
- APPROVED trying to access pending → /business/dashboard
- No business trying to access any business route → /business/onboarding
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                │
└─────────────────────────────────────────────────────────────────┘

Business Submission:
┌──────────┐    submitForVerification()    ┌──────────────┐
│ Business │ ──────────────────────────────→│   Service    │
│   User   │                                │              │
└──────────┘                                └──────┬───────┘
                                                   │
                                                   ↓
                                            ┌──────────────┐
                                            │   Database   │
                                            │              │
                                            │ Business:    │
                                            │ - status:    │
                                            │   PENDING    │
                                            │              │
                                            │ Log:         │
                                            │ - DRAFT →    │
                                            │   PENDING    │
                                            └──────────────┘

Admin Moderation:
┌──────────┐    approve(id, note)          ┌──────────────┐
│  Admin   │ ──────────────────────────────→│   Service    │
│   User   │                                │              │
└──────────┘                                └──────┬───────┘
                                                   │
                                                   ↓
                                            ┌──────────────┐
                                            │   Database   │
                                            │              │
                                            │ Business:    │
                                            │ - status:    │
                                            │   APPROVED   │
                                            │ - reviewNote │
                                            │ - approvedAt │
                                            │              │
                                            │ Log:         │
                                            │ - PENDING →  │
                                            │   APPROVED   │
                                            │ - note       │
                                            │ - reviewerId │
                                            └──────────────┘

Guard Check:
┌──────────┐    getCurrentUser()            ┌──────────────┐
│  Layout  │ ──────────────────────────────→│   Auth       │
│  Guard   │                                │   Service    │
└────┬─────┘                                └──────────────┘
     │
     │ getMyBusiness()
     ↓
┌──────────────┐    getEffectiveStatus()    ┌──────────────┐
│   Business   │ ──────────────────────────→│   Status     │
│   Service    │                            │   Helper     │
└──────┬───────┘                            └──────────────┘
       │
       │ if status !== APPROVED
       ↓
┌──────────────┐
│   Redirect   │
│ to /pending  │
└──────────────┘
```

---

## URL Stability Guarantee

```
┌─────────────────────────────────────────────────────────────────┐
│                    URL STABILITY GUARANTEE                       │
└─────────────────────────────────────────────────────────────────┘

Admin URLs (NEVER CHANGE):
✅ /admin/b2b/requests
✅ /admin/b2b/requests?status=PENDING
✅ /admin/b2b/requests?status=APPROVED
✅ /admin/b2b/requests?status=REJECTED
✅ /admin/b2b/requests?status=DRAFT

Business URLs (NEVER CHANGE):
✅ /business/onboarding
✅ /business/pending
✅ /business/dashboard
✅ /business/places
✅ /business/offers

Actions That DON'T Change URL:
✅ Switching tabs in admin (uses query params)
✅ Filtering business list (uses query params)
✅ Viewing business details (opens detail page, back link works)

Actions That DO Change URL (Expected):
✅ Approve/Reject → Redirects to filtered list
✅ Submit for review → Redirects to pending page
✅ Access protected route → Redirects to appropriate page
```

This visual documentation makes it easy to understand the complete flow!