/**
 * Cleanup script for expired PhoneOtp records
 * Usage: pnpm cleanup:otp
 */

import prisma from "../../src/lib/prisma";
import { cleanupExpiredPhoneOtps } from "../../src/lib/otp/cleanup";

async function main() {
  console.log("[cleanupPhoneOtps] Starting cleanup...");

  try {
    const deletedCount = await cleanupExpiredPhoneOtps(prisma);
    console.log(`[cleanupPhoneOtps] Deleted ${deletedCount} expired OTP record(s)`);
  } catch (error) {
    console.error("[cleanupPhoneOtps] Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  process.exit(0);
}

main();
