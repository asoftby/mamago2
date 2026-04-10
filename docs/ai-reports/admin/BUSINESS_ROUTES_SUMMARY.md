# Business Routes Summary - Consolidation Complete

## Removed/Redirected Routes

### `/business/pending` - REDIRECTED ✅

**Status**: Replaced with redirect to `/business/verification`

**Old Implementation**: Full page with status display (~200 lines)

**New Implementation**: Simple redirect (5 lines)
```typescript
export default function LegacyPendingPageRedirect() {
  redirect("/business/verification");
}
```

**Reason**: Duplicate of verification functionality

**Backward Compatibility**: ✅ Yes (automatic redirect)

---

## Canonical Routes (Final)

### 1. `/business/onboarding`
**Purpose**: Create/edit business profile

**Access**:
- DRAFT: ✅ Editable (new business)
- PENDING: ❌ Redirects to verification
- REJECTED: ✅ Editable (fix mode)
- APPROVED: ❌ Redirects to dashboard

**Features**:
- Form with УНП, legal name, phone
- УНП lookup integration
- Phone verification
- Submit for review button
- Shows rejection banner when REJECTED

---

### 2. `/business/verification` (CANONICAL)
**Purpose**: Show verification status and moderator feedback

**Access**:
- DRAFT: ✅ Shows "Complete profile" message
- PENDING: ✅ Shows "Under review" message
- REJECTED: ✅ Shows rejection reason + "Fix & Resubmit"
- APPROVED: ❌ Redirects to dashboard

**Features**:
- Status-specific UI (DRAFT/PENDING/REJECTED)
- Moderator comments display
- Verification history (last 5 logs)
- Business data summary
- "Fix & Resubmit" button (REJECTED only)
- Support contact link

**Data Sources**:
- `business.reviewNote` - Last moderator comment
- `business.reviewedAt` - Last review timestamp
- `BusinessVerificationLog` - Full history

---

### 3. `/business/dashboard`
**Purpose**: Main business dashboard

**Access**:
- DRAFT: ❌ Redirects to onboarding
- PENDING: ❌ Redirects to verification
- REJECTED: ❌ Redirects to verification
- APPROVED: ✅ Full access

**Features**:
- Business statistics
- Quick actions
- Navigation to places/offers

---

### 4. `/business/places`
**Purpose**: Manage business locations

**Access**: APPROVED only (protected by layout)

---

### 5. `/business/offers`
**Purpose**: Manage business offers

**Access**: APPROVED only (protected by layout)

---

## Route Comparison

### Before Consolidation
```
/business/pending
├── DRAFT: "Complete profile" UI
├── PENDING: "Under review" UI
├── REJECTED: "Rejected" UI + rejection reason
└── APPROVED: Redirect to dashboard

/business/verification
└── (did not exist)
```

### After Consolidation
```
/business/pending
└── Redirect to /business/verification

/business/verification (CANONICAL)
├── DRAFT: "Complete profile" UI
├── PENDING: "Under review" UI
├── REJECTED: "Rejected" UI + rejection reason + history
└── APPROVED: Redirect to dashboard
```

---

## References Updated

### Files Modified

1. **src/app/business/onboarding/actions.ts**
   - Line ~46: `redirect("/business/verification")` (was `/business/pending`)
   - Line ~50: `redirect("/business/verification")` (was `/business/pending`)
   - Line ~112: `redirect("/business/verification")` (was `/business/pending`)
   - Line ~125: `redirect("/business/verification")` (was `/business/pending`)

2. **src/app/business/(protected)/layout.tsx**
   - Line ~28: `redirect("/business/verification")` (was `/business/pending`)

3. **src/app/business/pending/page.tsx**
   - Entire file replaced with redirect

---

## Guard Location

### File
`src/server/guards/requireBusinessVerification.ts`

### Functions

**getBusinessGateTarget(status)**
- Returns target route based on status
- Single source of truth for status-to-route mapping

**enforceBusinessAccess(requestedPath, status)**
- Determines if access should be allowed or redirected
- Returns `null` if allowed, or redirect path if should redirect

**requiresVerificationCheck(path)**
- Checks if a route requires verification
- Used to determine if guard should be applied

**getStatusLabel(status)**
- Returns user-friendly status label in Russian

### Usage Pattern

```typescript
// In layout or middleware
import { enforceBusinessAccess } from "@/server/guards/requireBusinessVerification";

const redirectPath = enforceBusinessAccess(pathname, verificationStatus);
if (redirectPath) {
  redirect(redirectPath);
}
```

### Current Implementation
- Guard created as single source of truth
- Not yet integrated into middleware
- Current gating uses layout-based redirects
- Ready for future middleware integration

---

## Search Results

### Before Cleanup
```bash
$ grep -r "/business/pending" src/
src/app/business/onboarding/actions.ts:      redirect("/business/pending");
src/app/business/onboarding/actions.ts:      redirect("/business/pending");
src/app/business/onboarding/actions.ts:      redirect("/business/pending");
src/app/business/onboarding/actions.ts:  redirect("/business/pending");
src/app/business/(protected)/layout.tsx:    redirect("/business/pending");
```

### After Cleanup
```bash
$ grep -r "/business/pending" src/ --exclude="*.md"
src/app/business/pending/page.tsx: * /business/pending -> /business/verification
(only in redirect page comment)
```

---

## Build Output

### Routes Registered
```
├ ○ /business/pending (redirect)
├ ƒ /business/verification (canonical)
├ ƒ /business/onboarding
├ ƒ /business/dashboard
├ ƒ /business/places
└ ƒ /business/offers
```

### Legend
- `○` = Static (redirect)
- `ƒ` = Dynamic (server-rendered)

---

## Migration Guide

### For Users
**No action required** - Old URLs redirect automatically

### For Developers
1. Update bookmarks: `/business/pending` → `/business/verification`
2. Update documentation references
3. Use new canonical URL in new code
4. Old URL will continue to work (redirect)

### For Future
- Consider removing redirect after migration period (3-6 months)
- Monitor analytics for `/business/pending` usage
- When usage drops to zero, can safely delete redirect

---

## Summary

✅ **Consolidated**: 2 routes → 1 canonical route + 1 redirect
✅ **Simplified**: Single source of truth for verification status display
✅ **Enhanced**: Added moderator comments and verification history
✅ **Guarded**: Created unified guard for future middleware integration
✅ **Backward Compatible**: Old URL redirects automatically
✅ **Build Clean**: 0 TypeScript errors

**Result**: Cleaner, more maintainable business verification UX with single canonical route.
