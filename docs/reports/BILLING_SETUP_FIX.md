# Billing Setup Fix

## Error: Cannot read properties of undefined (reading 'aggregate')

This error occurs when the Prisma client is not properly generated after schema changes.

## Quick Fix (Easiest Method)

```bash
# Run the fix script
bash scripts/fix-billing.sh

# Then start dev server
npm run dev
```

Or manually:

```bash
# Generate Prisma client and restart
npm run db:generate && npm run dev
```

## What You'll See

If the Prisma client isn't generated, the billing pages will show a helpful error message with setup instructions instead of crashing.

## Full Setup (If Quick Fix Doesn't Work)

Run these commands in order:

```bash
# 1. Generate Prisma client
npm run db:generate

# 2. Run migrations (if needed)
npm run db:migrate

# 3. Seed database with test data
npm run db:seed

# 4. Start dev server
npm run dev
```

## Verification

After running the commands, test the billing pages:

1. Navigate to `http://localhost:3000/admin/billing` - should load without errors
2. Navigate to `http://localhost:3000/admin/billing/plans` - should show plans
3. Navigate to `http://localhost:3000/admin/billing/transactions` - should show transactions
4. Navigate to `http://localhost:3000/admin/billing/businesses` - should show business accounts
5. Navigate to `http://localhost:3000/admin/businesses/[businessId]/billing` - should show business billing with working action buttons

## If Error Still Persists

1. Clear Prisma cache:
```bash
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma
```

2. Reinstall and regenerate:
```bash
npm install
npm run db:generate
```

3. Restart dev server:
```bash
npm run dev
```

## Common Causes

- Prisma client not regenerated after schema changes
- Node modules cache issue
- TypeScript compilation cache
- Dev server not restarted after Prisma generation
- Missing billing tables in database

## Database Check

Verify billing tables exist:

```bash
# Connect to your database and check for billing tables
npx prisma studio
```

Look for these tables:
- BillingAccount
- Plan
- Subscription
- PaymentMethod
- BillingTransaction
- BillingDispute

If tables are missing, run:
```bash
npm run db:migrate
```

## New Installation

For a fresh setup:

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client (runs automatically via postinstall)
# If not, run manually:
npm run db:generate

# 3. Run migrations
npm run db:migrate

# 4. Seed database
npm run db:seed

# 5. Start dev server
npm run dev
```

## Available Scripts

- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with test data
- `npm run db:reset` - Reset database (WARNING: deletes all data)

## Notes

- The `postinstall` script now automatically runs `prisma generate` after `npm install`
- Always restart the dev server after running Prisma commands
- If using Turbopack (`npm run dev:turbo`), you may need to use regular mode for Prisma changes
