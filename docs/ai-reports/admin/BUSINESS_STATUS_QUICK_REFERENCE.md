# Business Status Quick Reference

## ⚡ Quick Rules

### ALWAYS Use
```typescript
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";

const status = getEffectiveVerificationStatus(business);
// Returns: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
```

### NEVER Use
```typescript
// ❌ DON'T DO THIS
if (business.status === "PENDING_VERIFICATION") { ... }

// ✅ DO THIS INSTEAD
const status = getEffectiveVerificationStatus(business);
if (status === "PENDING") { ... }
```

## 🎯 Status Meanings

| Status | Meaning | User Can |
|--------|---------|----------|
| `DRAFT` | Not submitted yet | Edit form, submit |
| `PENDING` | Under review | View status only (read-only) |
| `REJECTED` | Rejected by moderator | View reason, fix & resubmit |
| `APPROVED` | Verified & approved | Full dashboard access |

## 🚦 Routing Rules

```typescript
DRAFT    → /business/onboarding (edit form)
PENDING  → /business/verification (read-only)
REJECTED → /business/verification OR /business/onboarding
APPROVED → /business/dashboard (full access)
```

## 🔧 Common Patterns

### Check Status in Server Component
```typescript
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";
import { getMyBusiness } from "@/server/business/getMyBusiness";

const business = await getMyBusiness(userId);
const status = getEffectiveVerificationStatus(business);

if (status === "APPROVED") {
  // Allow access
}
```

### Enforce Access Control
```typescript
import { enforceBusinessAccess } from "@/server/guards/requireBusinessVerification";
import { getEffectiveVerificationStatus } from "@/server/services/businessStatusMap";

const status = getEffectiveVerificationStatus(business);
const redirectPath = enforceBusinessAccess(request.nextUrl.pathname, status);

if (redirectPath) {
  redirect(redirectPath);
}
```

### Write Status on Submit
```typescript
// When user submits onboarding form
await prisma.business.update({
  where: { id: businessId },
  data: {
    verificationStatus: "PENDING", // ✅ Canonical
    submittedAt: new Date(),
    status: "PENDING_VERIFICATION", // Legacy sync
    // Clear moderation fields on resubmit
    reviewedAt: null,
    reviewedByUserId: null,
    reviewNote: null,
    rejectedAt: null,
  },
});
```

### Admin Approval
```typescript
// When admin approves
await prisma.business.update({
  where: { id: businessId },
  data: {
    verificationStatus: "APPROVED", // ✅ Canonical
    reviewedAt: new Date(),
    reviewedByUserId: adminUserId,
    status: "APPROVED", // Legacy sync
  },
});
```

### Admin Rejection
```typescript
// When admin rejects
await prisma.business.update({
  where: { id: businessId },
  data: {
    verificationStatus: "REJECTED", // ✅ Canonical
    reviewedAt: new Date(),
    reviewedByUserId: adminUserId,
    reviewNote: "Reason for rejection",
    rejectedAt: new Date(),
    status: "REJECTED", // Legacy sync
  },
});
```

## 📋 Checklist for New Features

When adding business-related features:

- [ ] Use `getEffectiveVerificationStatus()` for status checks
- [ ] Never check `business.status` directly for routing
- [ ] Use `enforceBusinessAccess()` for access control
- [ ] Write `verificationStatus` when changing status
- [ ] Keep `status` in sync for backward compatibility
- [ ] Clear moderation fields on resubmit (if applicable)

## 🔍 Key Files

| File | Purpose |
|------|---------|
| `src/server/guards/requireBusinessVerification.ts` | Enforcement function |
| `src/server/services/businessStatusMap.ts` | Status mapping helper |
| `src/app/business/onboarding/actions.ts` | Form submission logic |
| `src/app/business/onboarding/page.tsx` | Editable form page |
| `src/app/business/verification/page.tsx` | Status display page |
| `src/app/business/(protected)/layout.tsx` | Protected route guard |

## 🐛 Debugging

### Check Current Status
```typescript
console.log("Raw verificationStatus:", business.verificationStatus);
console.log("Raw status:", business.status);
console.log("Effective status:", getEffectiveVerificationStatus(business));
```

### Check Access Control
```typescript
const redirectPath = enforceBusinessAccess("/business/dashboard", status);
console.log("Should redirect to:", redirectPath || "null (allowed)");
```

## ⚠️ Common Mistakes

### ❌ Mistake 1: Direct Status Check
```typescript
// DON'T
if (business.status === "PENDING_VERIFICATION") { ... }
```

### ✅ Fix
```typescript
// DO
const status = getEffectiveVerificationStatus(business);
if (status === "PENDING") { ... }
```

### ❌ Mistake 2: Forgetting to Clear Moderation Fields
```typescript
// DON'T (on resubmit)
await prisma.business.update({
  data: {
    verificationStatus: "PENDING",
    // Missing: reviewedAt, reviewNote, etc.
  },
});
```

### ✅ Fix
```typescript
// DO (on resubmit)
await prisma.business.update({
  data: {
    verificationStatus: "PENDING",
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedByUserId: null,
    reviewNote: null,
    rejectedAt: null,
  },
});
```

### ❌ Mistake 3: Not Syncing Legacy Status
```typescript
// DON'T
await prisma.business.update({
  data: {
    verificationStatus: "APPROVED",
    // Missing: status field
  },
});
```

### ✅ Fix
```typescript
// DO
await prisma.business.update({
  data: {
    verificationStatus: "APPROVED", // Canonical
    status: "APPROVED", // Legacy sync
  },
});
```

## 📚 Further Reading

- Full implementation: `BUSINESS_VERIFICATION_CANONICAL_COMPLETE.md`
- Flow diagram: See "Flow Diagram" section in complete doc
- Acceptance tests: See "Acceptance Tests" section in complete doc
