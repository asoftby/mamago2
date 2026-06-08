#!/usr/bin/env tsx
/**
 * One-time fix: archive all active VERIFY_PHONE onboarding notifications.
 *
 * Usage:
 *   pnpm tsx scripts/archive-verify-phone-notifications.ts
 *
 * Idempotent — только активные (archivedAt IS NULL) записи, повторный запуск ничего не сломает.
 */

import prisma from "../src/lib/prisma";

async function main() {
  const count = await prisma.notification.count({
    where: {
      audience: "USER",
      type: "SYSTEM",
      entityType: null,
      entityId: "VERIFY_PHONE",
      archivedAt: null,
    },
  });

  if (count === 0) {
    console.log("No active VERIFY_PHONE notifications found. Nothing to do.");
    return;
  }

  console.log(`Found ${count} active VERIFY_PHONE notification(s). Archiving...`);

  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: {
      audience: "USER",
      type: "SYSTEM",
      entityType: null,
      entityId: "VERIFY_PHONE",
      archivedAt: null,
    },
    data: {
      isRead: true,
      readAt: now,
      seenAt: now,
      archivedAt: now,
    },
  });

  console.log(`Done. Archived ${result.count} notification(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
