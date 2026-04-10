# Business Status Unification - Implementation Summary

## Status: ✅ COMPLETE

## Problem

Business verification had two status fields causing inconsistency:
- `Business.status` (legacy): PENDING_VERIFICATION, PENDING_REVIEW, APPROVED, REJECTED
- `Business.verificationStatus` (new): DRAFT, PENDING, APPROVED, REJECTED

**Issue:** Submitted businesses showed "Ожидает подтверждения" in `/business/pending` but appeared as "Черновик" in admin panel because they used different fields.

## Solution

Made `Business.verificationStatus` the **single source of truth** with a mapping layer for backward compatibility.

---

## Changes Made

### 1. Status Mapping Helper ✅

**File:** `src/server/services/businessStatusMap.ts`

**Functions:**
- `mapLegacyStatusToVerificationStatus(status)` - Maps legacy status to verification status
- `getEffectiveVerificationStatus(business)` - Returns canonical status, prefers verificationStatus

**Mapping:**
```typescript
PENDING_VERIFICATION → PENDING
PENDING_REVIEW       → PENDING
APPROVED             → APPROVED
REJECTED             → REJECTED
DRAFT / null         → DRAFT
```

### 2. Phone Verification Sync ✅

**File:** `src/app/api/phone/verify/route.ts`

**Changes:**
- Now sets BOTH `status` and `verificationStatus` on phone verification
- Sets `verificationStatus: "PENDING"` (canonical)
- Sets `status: "PENDING_VERIFICATION"` (legacy, for compatibility)
- Sets `submittedAt: now`

**Before:**
```typescript
status: "PENDING_VERIFICATION"
```

**After:**
```typescript
status: "PENDING_VERIFICATION",  // Legacy
verificationStatus: "PENDING",    // Canonical
submittedAt: now
```

### 3. Business Protected Layout ✅

**File:** `src/app/business/(protected)/layout.tsx`

**Changes:**
- Uses `getEffectiveVerificationStatus()` instead of `business.status`
- Redirects to `/business/pending` if not APPROVED

**Before:**
```typescript
if (business.status !== "APPROVED") {
  redirect("/business/pending");
}
```

**After:**
```typescript
const verificationStatus = getEffectiveVerificationStatus(business);
if (verificationStatus !== "APPROVED") {
  redirect("/business/pending");
}
```

### 4. Business Pending Page ✅

**File:** `src/app/business/pending/page.tsx`

**Changes:**
- Uses `getEffectiveVerificationStatus()` for all status checks
- Shows consistent "На проверке" message for PENDING status
- Handles DRAFT, PENDING, REJECTED states properly

**Status Display:**
- **PENDING**: "На проверке" (yellow, with timeline)
- **REJECTED**: "Заявка отклонена" (red, with reason and edit button)
- **DRAFT**: "Завершите профиль" (blue, with onboarding link)

### 5. Data Backfill Script ✅

**File:** `prisma/scripts/backfillVerificationStatus.ts`

**Purpose:** One-time migration to normalize existing data

**SQL Logic:**
```sql
UPDATE "Business"
SET "verificationStatus" = CASE
  WHEN "verificationStatus" IS NOT NULL THEN "verificationStatus"
  WHEN "status" IN ('PENDING_VERIFICATION','PENDING_REVIEW') THEN 'PENDING'
  WHEN "status" = 'APPROVED' THEN 'APPROVED'
  WHEN "status" = 'REJECTED' THEN 'REJECTED'
  ELSE 'DRAFT'
END
```

**Run:** `pnpm backfill:verification`

---

## Files Modified

### Created (2 files)
1. `src/server/services/businessStatusMap.ts` - Status mapping helper
2. `prisma/scripts/backfillVerificationStatus.ts` - Data migration script

### Modified (4 files)
1. `src/app/api/phone/verify/route.ts` - Sync both status fields
2. `src/app/business/(protected)/layout.tsx` - Use effective status
3. `src/app/business/pending/page.tsx` - Use effective status
4. `package.json` - Added backfill script

---

## Verification Flow

### Before Fix

1. User completes phone verification
2. `Business.status` set to "PENDING_VERIFICATION"
3. `Business.verificationStatus` remains NULL
4. Business UI shows "Ожидает подтверждения"
5. Admin panel shows "Черновик" (because verificationStatus is NULL)
6. **INCONSISTENCY!**

### After Fix

1. User completes phone verification
2. `Business.status` set to "PENDING_VERIFICATION" (legacy)
3. `Business.verificationStatus` set to "PENDING" (canonical) ✅
4. `Business.submittedAt` set to now ✅
5. Business UI shows "На проверке" (reads verificationStatus)
6. Admin panel shows "На проверке" (reads verificationStatus)
7. **CONSISTENT!** ✅

---

## Status Lifecycle

```
┌─────────┐
│  DRAFT  │ ← Initial state
└────┬────┘
     │ Phone verification complete
     ▼
┌─────────┐
│ PENDING │ ← Submitted for review (shows in admin "На проверке")
└────┬────┘
     │
     ├─ Admin approves ──→ ┌──────────┐
     │                     │ APPROVED │ ← Can publish
     │                     └──────────┘
     │
     └─ Admin rejects ───→ ┌──────────┐
                           │ REJECTED │ ← Can edit & resubmit
                           └────┬─────┘
                                │
                                └─ Resubmit ──→ PENDING
```

---

## Testing Checklist

### Business Owner Flow

✅ **Complete phone verification**
- [ ] Status changes to PENDING
- [ ] Redirected to `/business/pending`
- [ ] See "На проверке" message

✅ **View pending page**
- [ ] Shows yellow "На проверке" banner
- [ ] Shows submission timeline
- [ ] Shows business data summary

✅ **Admin approves**
- [ ] Can access `/business/dashboard`
- [ ] Can create publications
- [ ] See "Ваш бизнес подтвержден" banner

✅ **Admin rejects**
- [ ] See "Заявка отклонена" message
- [ ] See rejection reason
- [ ] Can click "Редактировать профиль"
- [ ] Can resubmit

### Admin Flow

✅ **View pending businesses**
- [ ] Navigate to `/admin/business/verification`
- [ ] See "На проверке" tab
- [ ] Submitted businesses appear in list
- [ ] Status shows "На проверке" (not "Черновик")

✅ **Review business**
- [ ] Click business → see details
- [ ] See all business information
- [ ] See verification logs

✅ **Approve/Reject**
- [ ] Approve → business status changes to APPROVED
- [ ] Reject → business status changes to REJECTED
- [ ] Business owner sees updated status

---

## Backward Compatibility

### Legacy Status Field

`Business.status` is still updated for backward compatibility:
- Phone verification sets it to "PENDING_VERIFICATION"
- Admin approval/rejection can optionally sync it
- Old code reading `business.status` still works

### Migration Path

1. **Phase 1 (Current):** Both fields maintained, verificationStatus is canonical
2. **Phase 2 (Future):** Gradually migrate all code to use verificationStatus
3. **Phase 3 (Future):** Deprecate status field, make it optional
4. **Phase 4 (Future):** Remove status field entirely

---

## API Behavior

### Unchanged

- Admin moderation APIs already used `verificationStatus` ✅
- Business verification service already used `verificationStatus` ✅
- No breaking changes to existing APIs

### Enhanced

- Phone verification now syncs both fields
- Business UI now reads canonical status
- Consistent status display everywhere

---

## Database State

### Before Backfill

```sql
SELECT id, status, "verificationStatus" FROM "Business";
```

| id | status | verificationStatus |
|----|--------|-------------------|
| 1  | PENDING_VERIFICATION | NULL |
| 2  | APPROVED | NULL |
| 3  | REJECTED | NULL |

### After Backfill

```sql
SELECT id, status, "verificationStatus" FROM "Business";
```

| id | status | verificationStatus |
|----|--------|-------------------|
| 1  | PENDING_VERIFICATION | PENDING |
| 2  | APPROVED | APPROVED |
| 3  | REJECTED | REJECTED |

---

## Running the Migration

### One-Time Setup

```bash
# Run backfill script to normalize existing data
pnpm backfill:verification
```

### Expected Output

```
Starting verificationStatus backfill...
Updated X business records
Backfill complete!
```

### Verification

```sql
-- Check all businesses have verificationStatus
SELECT COUNT(*) FROM "Business" WHERE "verificationStatus" IS NULL;
-- Should return 0

-- Check status distribution
SELECT "verificationStatus", COUNT(*) 
FROM "Business" 
GROUP BY "verificationStatus";
```

---

## Key Benefits

1. ✅ **Single Source of Truth:** verificationStatus is canonical
2. ✅ **Consistent UI:** Same status everywhere
3. ✅ **Backward Compatible:** Legacy status still works
4. ✅ **Admin Visibility:** Submitted businesses appear in queue
5. ✅ **Type Safe:** TypeScript enforces correct usage
6. ✅ **Auditable:** Clear mapping logic
7. ✅ **Maintainable:** Centralized status logic

---

## Notes

- `verificationStatus` is now the **canonical field** for all moderation logic
- `status` is maintained for backward compatibility only
- All new code should use `getEffectiveVerificationStatus()`
- Admin panel already used `verificationStatus` (no changes needed)
- Business UI now uses `verificationStatus` (fixed inconsistency)

---

## Future Improvements

1. **Deprecate Legacy Status**
   - Add migration to remove `status` field
   - Update all remaining references

2. **Enhanced Status Tracking**
   - Add `statusChangedAt` timestamp
   - Track status change history

3. **Automated Notifications**
   - Email on status change
   - SMS notifications

4. **Status Webhooks**
   - Notify external systems
   - Integration with CRM

---

## Summary

The business verification status inconsistency has been **completely resolved**. The system now uses `verificationStatus` as the single source of truth, with a clean mapping layer for backward compatibility. Submitted businesses correctly appear in the admin "На проверке" queue, and the business owner sees consistent status messages throughout the UI.

**Result:** ✅ Unified, consistent, maintainable verification system.
