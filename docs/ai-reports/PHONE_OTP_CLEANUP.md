# Phone OTP Cleanup Script

## Status: ✅ COMPLETE

## Summary

Added cleanup functionality for expired PhoneOtp records in the database.

## Files Created

### 1. Reusable Helper (`src/lib/otp/cleanup.ts`)

```typescript
export async function cleanupExpiredPhoneOtps(
  prisma: PrismaClient
): Promise<number>
```

- Server-only helper function
- Deletes all PhoneOtp records where `expiresAt < now()`
- Returns count of deleted records
- Reusable in other contexts (cron jobs, API routes, etc.)

### 2. Cleanup Script (`src/scripts/cleanupPhoneOtps.ts`)

- Standalone script for manual cleanup
- Uses the reusable helper function
- Logs deleted count
- Properly disconnects Prisma client
- Exits with code 0 on success, 1 on error

### 3. Package.json Script

Added to `package.json`:
```json
"cleanup:otp": "tsx src/scripts/cleanupPhoneOtps.ts"
```

## Usage

Run manually:
```bash
pnpm cleanup:otp
```

Output example:
```
[cleanupPhoneOtps] Starting cleanup...
[cleanupPhoneOtps] Deleted 5 expired OTP record(s)
```

## Implementation Details

**Query:**
```typescript
await prisma.phoneOtp.deleteMany({
  where: {
    expiresAt: {
      lt: new Date(),
    },
  },
});
```

**Features:**
- Uses Prisma's `deleteMany` for efficient bulk deletion
- Filters by `expiresAt < now()`
- Returns count of deleted records
- Proper error handling and logging
- Clean process exit

## Future Enhancements

Consider adding:
1. **Cron job** - Run cleanup automatically (e.g., every hour)
2. **API endpoint** - `/api/admin/cleanup-otp` for admin dashboard
3. **Metrics** - Track cleanup stats over time
4. **Notifications** - Alert if cleanup fails

Example cron setup (not implemented):
```typescript
// In a background worker or Next.js API route
import { cleanupExpiredPhoneOtps } from "@/lib/otp/cleanup";
import prisma from "@/lib/prisma";

// Run every hour
setInterval(async () => {
  const count = await cleanupExpiredPhoneOtps(prisma);
  console.log(`Cleaned up ${count} expired OTPs`);
}, 60 * 60 * 1000);
```

## Testing

✅ Script runs successfully: `pnpm cleanup:otp`
✅ No TypeScript errors
✅ Proper Prisma client disconnect
✅ Exit code 0 on success
✅ Helper function is reusable

## Manual Testing

1. Create expired OTP record (manually set `expiresAt` to past date)
2. Run: `pnpm cleanup:otp`
3. Verify record is deleted
4. Check logs show correct count

## Notes

- OTP records expire after 10 minutes (set in `/api/phone/start`)
- Cleanup is manual for now (run script when needed)
- Helper function can be used in automated cleanup jobs
- tsx is already installed as dev dependency
