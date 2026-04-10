# Business Verification Flow - Refactoring Analysis & Plan

## Current State Map

### Routes Inventory

#### Admin Routes
1. `/admin/b2b/requests` - **CANONICAL** (new, correct)
   - Reuses `BusinessVerificationList` component
   - Status tabs work correctly (stay on same route)
   
2. `/admin/business/verification` - **LEGACY REDIRECT**
   - Redirects to `/admin/b2b/requests`
   - Maintains backward compatibility
   
3. `/admin/business/verification/[id]` - **DETAIL PAGE**
   - Shows business details
   - Approve/reject actions
   - **PROBLEM**: After action, redirects to `/admin/business/verification?status=X` (wrong URL)

4. `/admin/b2b/partners` - Approved businesses list (separate feature)
5. `/admin/b2b/partners/[id]` - Business detail page (read-only)

#### Business Routes
1. `/business/onboarding` - Create business profile (DRAFT)
2. `/business/pending` - Status page for DRAFT/PENDING/REJECTED
3. `/business/dashboard` - Main dashboard (requires APPROVED)
4. `/business/places` - Places management (requires APPROVED)
5. `/business/offers` - Offers management (requires APPROVED)
6. `/business/(protected)/*` - Protected routes with layout guard

### Components

#### Admin Components
- `BusinessVerificationList` - List with status tabs
  - **FIXED**: Uses `router.replace()` to stay on same path
  - Located: `src/app/admin/business/verification/BusinessVerificationList.tsx`
  
- `BusinessVerificationDetail` - Detail page with approve/reject
  - **PROBLEM**: Redirects to wrong URL after actions
  - Located: `src/app/admin/business/verification/[id]/BusinessVerificationDetail.tsx`

#### Business Components
- `RequireVerifiedBusiness` - Guard component for APPROVED-only content
- `VerificationBanner` - Status banner (not currently used)

### Services & Guards

#### Services
- `businessVerification.service.ts` - **GOOD**
  - `submitForVerification()` - DRAFT/REJECTED → PENDING
  - `approve()` - PENDING → APPROVED
  - `reject()` - PENDING → REJECTED
  - `canPublish()` - Check if APPROVED
  - Creates audit logs in `BusinessVerificationLog`

- `businessStatusMap.ts` - **LEGACY COMPATIBILITY**
  - Maps old `Business.status` to `Business.verificationStatus`
  - `getEffectiveVerificationStatus()` - Prefers new field, falls back to old

#### Guards
- `/business/(protected)/layout.tsx` - **GOOD**
  - Checks auth
  - Checks business exists
  - Checks `verificationStatus === "APPROVED"`
  - Redirects to `/business/pending` if not approved

### Database Schema

```prisma
model Business {
  // Verification fields (CANONICAL)
  verificationStatus BusinessVerificationStatus @default(DRAFT)
  submittedAt        DateTime?
  reviewedAt         DateTime?
  reviewedByUserId   String?
  reviewNote         String?
  approvedAt         DateTime?
  rejectedAt         DateTime?
  
  // Legacy field (deprecated but still exists)
  status             BusinessStatus @default(DRAFT)
  
  verificationLogs   BusinessVerificationLog[]
}

enum BusinessVerificationStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
}

model BusinessVerificationLog {
  businessId       String
  statusFrom       BusinessVerificationStatus
  statusTo         BusinessVerificationStatus
  note             String?
  reviewedByUserId String?
  createdAt        DateTime
}
```

### API Routes

#### Admin APIs
- `GET /api/admin/business-verification?status=X` - List businesses
- `GET /api/admin/business-verification/[id]` - Get business details
- `POST /api/admin/business-verification/[id]/approve` - Approve
- `POST /api/admin/business-verification/[id]/reject` - Reject

#### Business APIs
- `POST /api/business/verification/submit` - Submit for verification

## Problems Identified

### 1. Wrong Redirect After Admin Actions ⚠️
**Location**: `BusinessVerificationDetail.tsx` lines 115, 145

```typescript
// WRONG - redirects to legacy URL
router.push("/admin/business/verification?status=APPROVED");
router.push("/admin/business/verification?status=REJECTED");
```

**Should be**:
```typescript
router.push("/admin/b2b/requests?status=APPROVED");
router.push("/admin/b2b/requests?status=REJECTED");
```

### 2. Detail Page Route Inconsistency
**Current**: `/admin/business/verification/[id]`
**Should be**: `/admin/b2b/requests/[id]` (to match canonical path)

However, this would require:
- Moving files
- Updating links in `BusinessVerificationList`
- Potential breaking changes

**Alternative**: Keep detail page where it is, just fix redirects (simpler)

### 3. Business Pending Page Doesn't Show Moderator Comments
**Location**: `src/app/business/pending/page.tsx`

Currently shows:
- Status (PENDING/REJECTED/DRAFT)
- Business data
- Generic messages

**Missing**:
- `business.reviewNote` (moderator comment)
- Verification history logs
- Last rejection reason

### 4. No "Resubmit" Flow for REJECTED
Business users see "Fix & resubmit" button but:
- It just links to `/business/onboarding`
- Onboarding page redirects to dashboard if business exists
- No clear way to edit and resubmit

### 5. Legacy Status Field Still Exists
`Business.status` (BusinessStatus enum) is deprecated but:
- Still in schema
- Still used in some places via `getEffectiveVerificationStatus()`
- Creates confusion

### 6. No Middleware for Subdomain Routing
Currently using layout-based guards, but no middleware to:
- Enforce subdomain rules
- Redirect business.* to business routes
- Redirect admin.* to admin routes

## Target Architecture

### Canonical Routes (Final State)

#### Admin Routes
```
/admin/b2b/requests                    - List with status tabs (CANONICAL)
/admin/b2b/requests/[id]               - Detail page with approve/reject (NEW)
/admin/b2b/partners                    - Approved businesses list
/admin/b2b/partners/[id]               - Business detail (read-only)
/admin/business/verification           - DELETED (redirect removed after migration)
/admin/business/verification/[id]      - DELETED (moved to /admin/b2b/requests/[id])
```

#### Business Routes
```
/business/onboarding                   - Create/edit business profile
/business/verification                 - Status page (DRAFT/PENDING/REJECTED) (RENAMED from /pending)
/business/dashboard                    - Main dashboard (APPROVED only)
/business/places                       - Places management (APPROVED only)
/business/offers                       - Offers management (APPROVED only)
```

### Status State Machine

```
DRAFT ──────────────────────────────────────────┐
  │                                              │
  │ submitForVerification()                      │
  ↓                                              │
PENDING                                          │
  │                                              │
  ├─ approve() ──→ APPROVED                      │
  │                                              │
  └─ reject() ───→ REJECTED ─────────────────────┘
                      │
                      │ submitForVerification()
                      └──────────────────────────→ PENDING
```

**Editable Fields by Status**:
- DRAFT: All fields editable
- PENDING: Read-only (under review)
- REJECTED: All fields editable (can fix and resubmit)
- APPROVED: Read-only (contact support to change)

### Guards & Middleware

#### Server-Side Guards (Layouts)
```typescript
// /business/(protected)/layout.tsx
1. Check auth → redirect to /login
2. Check business exists → redirect to /business/onboarding
3. Check verificationStatus === "APPROVED" → redirect to /business/verification
```

#### Route-Level Guards
```typescript
// /business/onboarding/page.tsx
1. Check auth → redirect to /register
2. If business exists AND status === "APPROVED" → redirect to /business/dashboard
3. If business exists AND status !== "APPROVED" → allow edit
4. If no business → allow create
```

```typescript
// /business/verification/page.tsx
1. Check auth → redirect to /login
2. Check business exists → redirect to /business/onboarding
3. If status === "APPROVED" → redirect to /business/dashboard
4. Show status page with moderator comments
```

### Moderation Log Display

#### Admin Side
- Full history in detail page
- Last 5 logs in partners detail page

#### Business Side
- Show `reviewNote` prominently on verification page
- Show last rejection reason
- Optional: show full history (last 3 entries)

### Resubmit Flow

```
REJECTED status:
1. User visits /business/verification
2. Sees rejection reason (reviewNote)
3. Clicks "Fix & Resubmit"
4. Goes to /business/onboarding (edit mode)
5. Edits fields
6. Clicks "Submit for Review"
7. Status changes: REJECTED → PENDING
8. Redirects to /business/verification (now shows PENDING)
```

## Implementation Plan

### Phase 1: Quick Fixes (No Breaking Changes)

#### Step 1.1: Fix Admin Redirect URLs
**File**: `src/app/admin/business/verification/[id]/BusinessVerificationDetail.tsx`

Change lines 115, 145:
```typescript
// OLD
router.push("/admin/business/verification?status=APPROVED");
router.push("/admin/business/verification?status=REJECTED");

// NEW
router.push("/admin/b2b/requests?status=APPROVED");
router.push("/admin/b2b/requests?status=REJECTED");
```

#### Step 1.2: Show Moderator Comments on Business Side
**File**: `src/app/business/pending/page.tsx`

Add section to show `business.reviewNote` when REJECTED:
```typescript
{isRejected && business.reviewNote && (
  <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
    <h2 className="text-lg font-semibold text-red-900 mb-3">
      Причина отклонения
    </h2>
    <p className="text-sm text-red-800">{business.reviewNote}</p>
  </div>
)}
```

#### Step 1.3: Fix Onboarding Redirect Logic
**File**: `src/app/business/onboarding/page.tsx`

Change redirect logic:
```typescript
// OLD
if (existingBusiness) {
  redirect("/business/dashboard");
}

// NEW
const verificationStatus = getEffectiveVerificationStatus(existingBusiness);
if (verificationStatus === "APPROVED") {
  redirect("/business/dashboard");
}
// Allow edit for DRAFT, PENDING, REJECTED
```

### Phase 2: Route Consolidation (Breaking Changes)

#### Step 2.1: Move Detail Page
**Move**: `src/app/admin/business/verification/[id]/*` → `src/app/admin/b2b/requests/[id]/*`

Files to move:
- `page.tsx`
- `BusinessVerificationDetail.tsx`

#### Step 2.2: Update Links
**File**: `src/app/admin/business/verification/BusinessVerificationList.tsx`

Change line with link:
```typescript
// OLD
<Link href={`/admin/business/verification/${business.id}`}>

// NEW
<Link href={`/admin/b2b/requests/${business.id}`}>
```

#### Step 2.3: Delete Legacy Routes
After migration period (1-2 weeks):
- Delete `/admin/business/verification/page.tsx` (redirect)
- Delete `/admin/business/verification/` folder entirely

### Phase 3: Rename Business Routes

#### Step 3.1: Rename /pending to /verification
**Move**: `src/app/business/pending/` → `src/app/business/verification/`

Update redirects in:
- `src/app/business/(protected)/layout.tsx`
- `src/app/business/onboarding/page.tsx`

### Phase 4: Schema Cleanup (Optional)

#### Step 4.1: Deprecate Business.status Field
Add migration to:
1. Ensure all records have `verificationStatus` set
2. Add comment to schema: `status BusinessStatus @default(DRAFT) // DEPRECATED: Use verificationStatus`

#### Step 4.2: Remove businessStatusMap.ts
After confirming all code uses `verificationStatus` directly.

## Testing Checklist

### Admin Flow
- [ ] Visit `/admin/b2b/requests` - shows PENDING tab
- [ ] Click "Одобрено" tab - URL stays `/admin/b2b/requests?status=APPROVED`
- [ ] Click "Подробнее" on business - opens detail page
- [ ] Click "Одобрить" - redirects to `/admin/b2b/requests?status=APPROVED`
- [ ] Click "Отклонить" - redirects to `/admin/b2b/requests?status=REJECTED`
- [ ] Visit `/admin/business/verification` - redirects to `/admin/b2b/requests`

### Business Flow - New Registration
- [ ] Register account
- [ ] Visit `/business/onboarding` - shows form
- [ ] Fill form, submit - creates business with DRAFT status
- [ ] Click "Submit for Review" - status changes to PENDING
- [ ] Redirects to `/business/verification` - shows "На проверке"
- [ ] Try to visit `/business/dashboard` - redirects to `/business/verification`

### Business Flow - Approval
- [ ] Admin approves business
- [ ] Business user visits `/business/verification` - redirects to `/business/dashboard`
- [ ] Can access `/business/places`, `/business/offers`

### Business Flow - Rejection
- [ ] Admin rejects business with note "УНП неверный"
- [ ] Business user visits `/business/verification` - shows "Отклонено"
- [ ] Shows rejection reason: "УНП неверный"
- [ ] Click "Fix & Resubmit" - goes to `/business/onboarding`
- [ ] Can edit fields
- [ ] Click "Submit for Review" - status changes REJECTED → PENDING
- [ ] Redirects to `/business/verification` - shows "На проверке"

### Edge Cases
- [ ] Business with PENDING tries to access dashboard - blocked
- [ ] Business with REJECTED tries to create place - blocked
- [ ] Non-admin tries to access `/admin/b2b/requests` - blocked
- [ ] User without business tries to access `/business/dashboard` - redirects to onboarding

## Migration Strategy

### Week 1: Quick Fixes (Non-Breaking)
- Deploy Phase 1 changes
- Monitor for issues
- Keep legacy routes as redirects

### Week 2-3: Route Consolidation
- Deploy Phase 2 changes
- Update documentation
- Notify users of URL changes (if any bookmarks)

### Week 4: Cleanup
- Deploy Phase 3 changes
- Remove legacy redirects
- Update all internal links

### Future: Schema Cleanup
- Plan migration to remove `Business.status`
- Update all queries to use `verificationStatus`
- Remove compatibility layer

## Success Criteria

1. ✅ No duplicate routes doing the same thing
2. ✅ Admin moderation stays on `/admin/b2b/requests` (no URL changes)
3. ✅ Business users see moderator comments
4. ✅ REJECTED businesses can fix and resubmit
5. ✅ Single source of truth for verification status
6. ✅ All guards use centralized service
7. ✅ No ad-hoc status checks scattered in components
8. ✅ Stable URLs that don't change during user actions
