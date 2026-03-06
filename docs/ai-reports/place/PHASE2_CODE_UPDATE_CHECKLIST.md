# Phase 2: Code Update Checklist

## Files Requiring NEEDS_CHANGES → NEEDS_REVISION Updates

### Priority 1: Backend Services (Critical)
- [ ] `src/server/services/moderation.service.ts`
- [ ] `src/server/services/notification.service.ts`

### Priority 2: API Routes (Critical)
- [ ] `src/app/api/admin/moderation/places/[id]/route.ts`
- [ ] `src/app/api/admin/places/[id]/needs-changes/route.ts` (consider renaming file)
- [ ] `src/app/api/business/places/[id]/submit/route.ts`
- [ ] `src/app/api/business/activities-v2/[id]/submit/route.ts`

### Priority 3: Admin UI (High)
- [ ] `src/components/admin/PlaceModerationView.tsx`
- [ ] `src/components/admin/PlaceModerationSidePanel.tsx`
- [ ] `src/app/admin/moderation/places/page.tsx`

### Priority 4: Business UI (High)
- [ ] `src/components/business/places/PlaceCardHorizontal.tsx`
- [ ] `src/components/business/notifications/NotificationList.tsx`

### Priority 5: Test Scripts (Medium)
- [ ] `scripts/test-place-moderation.ts`
- [ ] `scripts/test-notification-ui.ts`
- [ ] `scripts/test-place-types.ts`
- [ ] `scripts/test-notification-system.ts`
- [ ] `scripts/test-place-api.ts`
- [ ] `scripts/test-moderation-system.ts`

## Global Find/Replace Commands

```bash
# Find all occurrences
grep -r "NEEDS_CHANGES" src/ scripts/ --include="*.ts" --include="*.tsx"

# Count occurrences
grep -r "NEEDS_CHANGES" src/ scripts/ --include="*.ts" --include="*.tsx" | wc -l
```

## Verification After Updates

```bash
# TypeScript compilation
npx tsc --noEmit

# Run tests
npm test

# Check for any remaining references
grep -r "NEEDS_CHANGES" src/ scripts/ --include="*.ts" --include="*.tsx"
```

## Notes

- `APPROVED` in business verification files is correct (different enum)
- Step4Contacts.tsx already updated in previous fix
- Some files may need function renames (e.g., `needsChangesPlace` → `needsRevisionPlace`)

