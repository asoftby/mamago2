# Business Verification - Quick Start Guide

## For Business Owners

### How to Get Verified

1. **Complete Your Profile**
   - Go to business dashboard
   - Fill in all required information
   - Status: DRAFT

2. **Submit for Review**
   - Click "Отправить на проверку" button in banner
   - Status changes to PENDING
   - Wait 1-2 business days

3. **After Approval**
   - Status: APPROVED
   - Green "Ваш бизнес подтвержден" banner
   - Can now create Places, Offers, Events

4. **If Rejected**
   - See rejection reason in red banner
   - Click "Редактировать профиль" to fix issues
   - Click "Отправить повторно" to resubmit

### What You Can Do

| Status    | View Dashboard | Edit Profile | Create Publications |
|-----------|----------------|--------------|---------------------|
| DRAFT     | ✅             | ✅           | ❌                  |
| PENDING   | ✅             | ❌           | ❌                  |
| APPROVED  | ✅             | ❌           | ✅                  |
| REJECTED  | ✅             | ✅           | ❌                  |

---

## For Admins/Moderators

### How to Review Businesses

1. **Access Review Queue**
   - Navigate to `/admin/business/verification`
   - See PENDING tab (default)

2. **Review Business**
   - Click business name
   - Review all information
   - Check owner details

3. **Make Decision**
   - **To Approve:**
     - Enter optional note
     - Click "Одобрить" (green button)
   - **To Reject:**
     - Enter required reason
     - Click "Отклонить" (red button)

4. **After Decision**
   - Business owner sees updated status immediately
   - Log entry created automatically

### Admin Routes

- `/admin/business/verification` - List view
- `/admin/business/verification/[id]` - Detail view

---

## For Developers

### Using the Verification Guard

**In UI Components:**
```tsx
import { RequireVerifiedBusiness } from "@/components/business/RequireVerifiedBusiness";

<RequireVerifiedBusiness status={business.verificationStatus}>
  <CreatePlaceForm />
</RequireVerifiedBusiness>
```

**In API Routes:**
```typescript
import { requireVerifiedBusiness } from "@/server/auth/requireVerifiedBusiness";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  await requireVerifiedBusiness(user.id); // Throws if not approved
  
  // Create publication...
}
```

### Service Functions

```typescript
import {
  submitForVerification,
  approve,
  reject,
  canPublish
} from "@/server/services/businessVerification.service";

// Submit for review
await submitForVerification(businessId, userId);

// Admin approve
await approve(businessId, adminId, "Looks good!");

// Admin reject
await reject(businessId, adminId, "Missing documents");

// Check if can publish
if (canPublish(business.verificationStatus)) {
  // Allow publication creation
}
```

---

## API Endpoints

### Business Endpoints

**Submit for Review:**
```
POST /api/business/verification/submit
Auth: Required (business owner)
Response: { ok: true, message: string }
```

### Admin Endpoints

**List Businesses:**
```
GET /api/admin/business-verification?status=PENDING
Auth: Required (ADMIN/MODERATOR)
Response: { ok: true, businesses: [...] }
```

**Get Business Details:**
```
GET /api/admin/business-verification/[id]
Auth: Required (ADMIN/MODERATOR)
Response: { ok: true, business: {...} }
```

**Approve Business:**
```
POST /api/admin/business-verification/[id]/approve
Auth: Required (ADMIN/MODERATOR)
Body: { note?: string }
Response: { ok: true, message: string }
```

**Reject Business:**
```
POST /api/admin/business-verification/[id]/reject
Auth: Required (ADMIN/MODERATOR)
Body: { note: string } (required)
Response: { ok: true, message: string }
```

---

## Status Flow

```
┌─────────┐
│  DRAFT  │ ← Initial state
└────┬────┘
     │ Submit
     ▼
┌─────────┐
│ PENDING │ ← Under review
└────┬────┘
     │
     ├─ Approve ──→ ┌──────────┐
     │              │ APPROVED │ ← Can publish
     │              └──────────┘
     │
     └─ Reject ───→ ┌──────────┐
                    │ REJECTED │ ← Can edit & resubmit
                    └────┬─────┘
                         │
                         └─ Resubmit ──→ PENDING
```

---

## Common Issues

### "Cannot create publications"
- **Cause:** Status is not APPROVED
- **Solution:** Wait for admin approval or check rejection reason

### "Cannot submit for review"
- **Cause:** Status is PENDING (already submitted)
- **Solution:** Wait for admin review

### "Rejection note required"
- **Cause:** Admin trying to reject without note
- **Solution:** Enter rejection reason before clicking reject

---

## Database Schema

```prisma
enum BusinessVerificationStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
}

model Business {
  verificationStatus BusinessVerificationStatus @default(DRAFT)
  submittedAt        DateTime?
  reviewedAt         DateTime?
  reviewedByUserId   String?
  reviewNote         String?
  approvedAt         DateTime?
  rejectedAt         DateTime?
}
```

---

## Need Help?

See full documentation:
- `BUSINESS_VERIFICATION_COMPLETE.md` - Complete system overview
- `BUSINESS_VERIFICATION_SYSTEM.md` - Technical implementation details
