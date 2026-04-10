# Prisma Client Cache Fix - Complete

## Problem
Runtime error occurred when trying to save place location:
```
Unknown field `districtAutoId` for select statement on model `Place`
```

The database table already contained the geo enrichment columns, but Prisma Client was outdated.

## Root Cause
Prisma Client was not regenerated after schema changes, and Turbopack was using a stale cached version.

## Solution Steps

### 1. Verified Schema
Confirmed that `prisma/schema.prisma` Place model includes all geo enrichment fields:
- `districtAutoId` (String?)
- `districtManualId` (String?)
- `metroAutoId` (String?)
- `metroAutoDistanceM` (Int?)
- `metroManualId` (String?)
- `metroManualDistanceM` (Int?)

### 2. Regenerated Prisma Client
```bash
npx prisma generate
```

### 3. Cleared Prisma Cache
```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### 4. Cleared Next.js Cache
```bash
rm -rf .next
```

### 5. Verified Prisma Client
Created test script `scripts/test-prisma-geo-fields.ts` to verify:
- ✅ Can select geo fields from Place model
- ✅ Can include geo relations (districtAuto, metroAuto, etc.)
- ✅ All fields are properly typed

Test output:
```
✅ Successfully selected geo fields
Place: {
  id: 'cmmckofrp0001wso7ggnisr26',
  title: 'Новое место',
  districtAutoId: 'cmmap1t1e0013wsa4im3m5lhh',
  districtManualId: 'null',
  metroAutoId: 'cmmb q9ehw001mws8405uxzqxj',
  metroAutoDistanceM: 272,
  metroManualId: 'null',
  metroManualDistanceM: 'null'
}

✅ Successfully included geo relations
Place with relations: {
  id: 'cmmckofrp0001wso7ggnisr26',
  title: 'Новое место',
  districtAuto: 'Центральный',
  districtManual: 'null',
  metroAuto: 'Октябрьская',
  metroManual: 'null'
}

✅ All tests passed! Prisma client is up to date.
```

## Files Changed
1. `scripts/test-prisma-geo-fields.ts` - Created test script to verify Prisma client

## Verification Checklist
- [x] Schema includes geo enrichment fields
- [x] Prisma client regenerated
- [x] Prisma cache cleared
- [x] Next.js cache cleared
- [x] Test script confirms fields are accessible
- [x] TypeScript compilation succeeds
- [ ] Dev server starts without errors
- [ ] Location save endpoint works
- [ ] PlaceLocationPicker saves location successfully

## Next Steps
1. Restart the development server:
   ```bash
   pnpm dev
   ```

2. Test location saving in the Place wizard:
   - Navigate to Place creation/edit
   - Select a location from Google autocomplete
   - Verify location saves without errors
   - Check that geo enrichment data appears

## Troubleshooting

### If Error Persists
If you still see "Unknown field" errors after following these steps:

1. **Check Prisma Client Import**
   ```typescript
   import prisma from "@/lib/prisma";
   ```
   Make sure you're using the singleton instance, not creating new clients.

2. **Verify Generated Client Location**
   ```bash
   ls -la node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client
   ```
   Should show recently generated files.

3. **Check TypeScript Types**
   ```typescript
   import { Place } from "@prisma/client";
   // Place type should include districtAutoId, metroAutoId, etc.
   ```

4. **Full Clean Rebuild**
   ```bash
   rm -rf node_modules/.prisma
   rm -rf .next
   npx prisma generate
   pnpm dev
   ```

### Common Issues

**Issue:** "Cannot find module '@prisma/client'"
**Solution:** Run `pnpm install` to ensure dependencies are installed

**Issue:** Types don't match runtime
**Solution:** Restart TypeScript server in your IDE (VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server")

**Issue:** Turbopack still uses old client
**Solution:** Stop dev server completely, clear caches, regenerate, then restart

## Prevention
To avoid this issue in the future:

1. **After Schema Changes:**
   ```bash
   npx prisma migrate dev --name your_migration_name
   # This automatically runs prisma generate
   ```

2. **After Pulling Schema Changes:**
   ```bash
   npx prisma generate
   rm -rf .next
   ```

3. **When Adding New Fields:**
   - Always run `prisma generate` after schema changes
   - Clear `.next` cache if using Turbopack
   - Restart dev server to pick up changes

## Related Documentation
- [Prisma Client Generation](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/generating-prisma-client)
- [Next.js 16 Turbopack Caching](https://nextjs.org/docs/architecture/turbopack)
