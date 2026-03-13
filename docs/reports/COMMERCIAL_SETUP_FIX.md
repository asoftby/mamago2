# Commercial Setup Fix - Prisma Client Generation

**Issue**: `Cannot read properties of undefined (reading 'count')`  
**Cause**: Prisma client not regenerated after adding commercial models  
**Solution**: Regenerate Prisma client and restart dev server

---

## Quick Fix

Run these commands in order:

```bash
# 1. Stop dev server (Ctrl+C if running)

# 2. Generate Prisma client
npx prisma generate

# 3. Seed commercial data (optional, for test data)
npx tsx prisma/seed-commercial.ts

# 4. Restart dev server
npm run dev
```

---

## Detailed Steps

### 1. Stop Dev Server
Press `Ctrl+C` in the terminal where dev server is running.

### 2. Generate Prisma Client
This regenerates the Prisma client with the new commercial models:

```bash
npx prisma generate
```

Expected output:
```
✔ Generated Prisma Client (v5.x.x) to ./node_modules/@prisma/client
```

### 3. Seed Commercial Data (Optional)
If you want test data for development:

```bash
npx tsx prisma/seed-commercial.ts
```

Expected output:
```
🏢 Seeding Commercial Layer...
Found 1 businesses
📄 Creating contracts...
✅ Created 1 contracts
🎯 Creating placements...
✅ Created 1 placements
⭐ Creating service placements...
✅ Created 2 service placements
🔔 Creating commercial notifications...
✅ Created 2 commercial notifications
✅ Commercial Layer seeding completed!
```

### 4. Restart Dev Server
```bash
npm run dev
```

### 5. Verify
Navigate to:
- `http://localhost:3000/admin/commercial` - Should load without errors
- Check KPI cards show numbers (not errors)
- Verify tables load data

---

## Why This Happens

When you add new Prisma models to `schema.prisma`, the TypeScript types and database client need to be regenerated. The commercial models were added but the client wasn't regenerated, causing runtime errors when trying to query the new tables.

---

## Error Handling Added

The `/admin/commercial` page now shows a helpful error message if Prisma client is not generated, with instructions on how to fix it.

---

## Verification Checklist

After running the fix:

- [ ] Dev server starts without errors
- [ ] `/admin/commercial` page loads
- [ ] KPI cards show numbers (0 or actual counts)
- [ ] No "Cannot read properties of undefined" errors
- [ ] Tables load (may be empty if no seed data)
- [ ] Navigation works between commercial pages

---

## If Still Having Issues

### Check Database Connection
```bash
npx prisma studio
```

Should open Prisma Studio. Check if these tables exist:
- BusinessContract
- BusinessPlacement
- BusinessServicePlacement
- CommercialNotification

### Check Migration Status
```bash
npx prisma migrate status
```

If migrations are pending:
```bash
npx prisma migrate dev
```

### Reset Database (Nuclear Option)
⚠️ This will delete all data:
```bash
npx prisma migrate reset
npx tsx prisma/seed-billing.ts
npx tsx prisma/seed-commercial.ts
```

---

## Summary

The error was caused by Prisma client not being regenerated after adding commercial models. Running `npx prisma generate` fixes the issue by regenerating the client with the new models.
