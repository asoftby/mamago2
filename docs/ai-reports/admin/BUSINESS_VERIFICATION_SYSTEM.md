# Business Verification System

## Status: ✅ COMPLETE

## Overview

Implemented a complete business verification/moderation workflow where:
1. Business owners submit their profile for verification
2. Admins/moderators review and approve/reject submissions
3. Only APPROVED businesses can create publications (Place/Offer/Event)
4. Enforcement happens both in UI and server-side API

## Architecture

### Single Source of Truth
- Database (Prisma) stores verification status
- Service layer centralizes business logic
- API routes enforce permissions
- UI reflects current state

### Clean Separation
- **Service Layer**: Business logic (submit, approve, reject, canPublish)
- **API Routes**: HTTP interface with auth checks
- **UI Components**: Display state and trigger actions
- **Guards**: Reusable permission checks

---

## A) DATA MODEL

### Prisma Schema Changes

**New Enum:**
```prisma
enum BusinessVerificationStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
}
```

**Business Model Updates:**
```prisma
model Business {
  // ... existing fields ...
  
  // Verification fields
  verificationStatus BusinessVerificationStatus @default(DRAFT)
  submittedAt        DateTime?
  reviewedAt         DateTime?
  reviewedByUserId   String?
  reviewNote         String?
  approvedAt         DateTime?
  rejectedAt         DateTime?
  
  verificationLogs BusinessVerificationLog[]
  
  @@index([verificationStatus])
}
```

**New Audit Log Model:**
```prisma
model BusinessVerificationLog {
  id               String                        @id @default(cuid())
  businessId       String
  statusFrom       BusinessVerificationStatus
  statusTo         BusinessVerificationStatus
  note             String?
  reviewedByUserId String?
  
  business   Business @relation(...)
  reviewedBy User?    @relation(...)
  
  createdAt DateTime @default(now())
  
  @@index([businessId, createdAt])
}
```

**Migration:** `20260302234136_add_business_verification`

---

## B) SERVICE LAYER

### File: `src/server/services/businessVerification.service.ts`

**Functions:**

1. **submitForVerification(businessId, actorUserId)**
   - Validates: status must be DRAFT or REJECTED
   - Validates: actor must be business owner
   - Updates: status → PENDING, submittedAt → now
   - Creates: log entry

2. **approve(businessId, actorUserId, note?)**
   - Validates: status must be PENDING
   - Updates: status → APPROVED, reviewedAt, approvedAt, reviewedByUserId, reviewNote
   - Creates: log entry

3. **reject(businessId, actorUserId, note)**
   - Validates: status must be PENDING, note required
   - Updates: status → REJECTED, reviewedAt, rejectedAt, reviewedByUserId, reviewNote
   - Creates: log entry

4. **canPublish(status): boolean**
   - Returns: true only if status === APPROVED

### File: `src/server/auth/requireVerifiedBusiness.ts`

**Function:**
- `requireVerifiedBusiness(userId)` - Throws error if business not approved
- Use in API routes that create publications

---

## C) API ROUTES

### Business Routes

**POST /api/business/verification/submit**
- Auth: Required (business owner)
- Action: Submit business for verification
- Response: `{ ok: true, message }`

### Admin Routes

**GET /api/admin/business-verification?status=PENDING**
- Auth: Required (ADMIN or MODERATOR)
- Query: status filter (DRAFT|PENDING|APPROVED|REJECTED)
- Response: `{ ok: true, businesses: [...] }`

**GET /api/admin/business-verification/[id]**
- Auth: Required (ADMIN or MODERATOR)
- Response: `{ ok: true, business: {..., verificationLogs: [...]} }`

**POST /api/admin/business-verification/[id]/approve**
- Auth: Required (ADMIN or MODERATOR)
- Body: `{ note?: string }`
- Response: `{ ok: true, message }`

**POST /api/admin/business-verification/[id]/reject**
- Auth: Required (ADMIN or MODERATOR)
- Body: `{ note: string }` (required)
- Response: `{ ok: true, message }`

---

## D) ADMIN UI

### Pages

**`/admin/business/verification`**
- Status tabs: PENDING (default), APPROVED, REJECTED, DRAFT
- Table view with: name, owner, UNP, status, submitted date
- Click row → detail page

**`/admin/business/verification/[id]`**
- Business info (name, legal name, UNP, phone)
- Owner info (email, phone, registration date)
- Review note (if exists)
- Verification logs timeline
- Moderation panel (if status === PENDING):
  - Textarea for note
  - Approve button (green)
  - Reject button (red, requires note)

### Components

- `BusinessVerificationList.tsx` - List with filters
- `BusinessVerificationDetail.tsx` - Detail view with moderation

---

## E) BUSINESS UI

### Components

**`VerificationBanner.tsx`**
- Shows status-specific banner in business dashboard
- **DRAFT**: "Complete profile and submit" + Submit button
- **PENDING**: "Profile under review" (no action)
- **REJECTED**: Shows review note + "Edit profile" + "Resubmit" buttons
- **APPROVED**: "Verified" badge (green)

**`RequireVerifiedBusiness.tsx`**
- Guard component for publication creation
- If status !== APPROVED: Shows blocked state UI
- If status === APPROVED: Renders children

### Usage Example

```tsx
import { RequireVerifiedBusiness } from "@/components/business/RequireVerifiedBusiness";

export default function CreatePlacePage() {
  const business = await getBusiness();
  
  return (
    <RequireVerifiedBusiness status={business.verificationStatus}>
      <CreatePlaceForm />
    </RequireVerifiedBusiness>
  );
}
```

---

## F) WORKFLOW

### Business Owner Flow

1. **DRAFT** → Fill profile → Click "Submit for verification"
2. **PENDING** → Wait for admin review (banner shows "under review")
3. **APPROVED** → Can create publications
4. **REJECTED** → See reason → Edit profile → Resubmit

### Admin Flow

1. Navigate to `/admin/business/verification`
2. See PENDING tab (default)
3. Click business → See details
4. Review profile information
5. Enter note (optional for approve, required for reject)
6. Click "Approve" or "Reject"
7. Business owner sees updated status

---

## G) FILES CREATED/MODIFIED

### Created Files

**Service Layer:**
- `src/server/services/businessVerification.service.ts`
- `src/server/auth/requireVerifiedBusiness.ts`

**API Routes:**
- `src/app/api/business/verification/submit/route.ts`
- `src/app/api/admin/business-verification/route.ts`
- `src/app/api/admin/business-verification/[id]/route.ts`
- `src/app/api/admin/business-verification/[id]/approve/route.ts`
- `src/app/api/admin/business-verification/[id]/reject/route.ts`

**Admin UI:**
- `src/app/admin/business/verification/page.tsx`
- `src/app/admin/business/verification/BusinessVerificationList.tsx`
- `src/app/admin/business/verification/[id]/page.tsx`
- `src/app/admin/business/verification/[id]/BusinessVerificationDetail.tsx`

**Business UI:**
- `src/components/business/VerificationBanner.tsx`
- `src/components/business/RequireVerifiedBusiness.tsx`

### Modified Files

**Database:**
- `prisma/schema.prisma` - Added verification fields and log model
- `prisma/migrations/20260302234136_add_business_verification/` - Migration

---

## H) SECURITY & PERMISSIONS

### Server-Side Enforcement

1. **API Routes**: All admin routes check `user.role === "ADMIN" || "MODERATOR"`
2. **Service Layer**: Validates business owner before submit
3. **Guard Utility**: `requireVerifiedBusiness()` throws error if not approved
4. **Transaction Safety**: All status changes use Prisma transactions

### UI Enforcement

1. **Guard Component**: Blocks UI if not approved
2. **Banner**: Shows appropriate actions based on status
3. **Admin Access**: Only ADMIN/MODERATOR can access admin pages

---

## I) TESTING CHECKLIST

### Business Owner Tests

✅ Submit profile for verification (DRAFT → PENDING)
✅ See "under review" banner when PENDING
✅ Cannot create publications when not APPROVED
✅ See rejection note when REJECTED
✅ Can resubmit after rejection
✅ See "verified" badge when APPROVED
✅ Can create publications when APPROVED

### Admin Tests

✅ See list of businesses by status
✅ Filter by PENDING/APPROVED/REJECTED/DRAFT
✅ View business details
✅ See verification logs timeline
✅ Approve business with optional note
✅ Reject business with required note
✅ Cannot approve/reject if not PENDING

### API Tests

✅ Submit requires authentication
✅ Submit requires business ownership
✅ Admin routes require ADMIN/MODERATOR role
✅ Approve/reject only work on PENDING status
✅ Reject requires note
✅ All actions create log entries

---

## J) FUTURE ENHANCEMENTS

1. **Email Notifications**: Notify owner on approval/rejection
2. **Bulk Actions**: Approve/reject multiple businesses at once
3. **Advanced Filters**: Search by name, UNP, owner email
4. **Analytics**: Track approval rates, average review time
5. **Auto-Approval**: For trusted businesses or specific criteria
6. **Revision Requests**: Admin can request specific changes
7. **Document Upload**: Require business documents for verification

---

## K) NOTES

- All UI text is in Russian (RU) as per project requirements
- Code comments and variable names in English
- Uses existing project patterns (getCurrentUser, PrimaryButton, etc.)
- No breaking changes to existing routing or middleware
- Minimal, reviewable changes
- TypeScript compilation passes
- Prisma client regenerated with new types
