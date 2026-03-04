#!/usr/bin/env tsx
/**
 * Bootstrap Admin Script
 * 
 * One-time script to promote the first admin user.
 * Reads email from ADMIN_BOOTSTRAP_EMAIL environment variable.
 * 
 * Usage:
 *   ADMIN_BOOTSTRAP_EMAIL=user@example.com pnpm tsx scripts/bootstrap-admin.ts
 */

import prisma from "../src/lib/prisma";

async function main() {
  console.log("[bootstrap-admin] Starting...\n");

  // Read email from environment
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;

  if (!email) {
    console.error("❌ Error: ADMIN_BOOTSTRAP_EMAIL environment variable is required");
    console.error("\nUsage:");
    console.error("  ADMIN_BOOTSTRAP_EMAIL=user@example.com pnpm tsx scripts/bootstrap-admin.ts\n");
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`❌ Error: Invalid email format: ${email}\n`);
    process.exit(1);
  }

  console.log(`📧 Looking for user: ${email}`);

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    console.error(`\n❌ Error: User with email "${email}" not found`);
    console.error("\nPlease ensure the user has registered first.\n");
    process.exit(1);
  }

  console.log(`✓ User found (ID: ${user.id})`);
  console.log(`  Current role: ${user.role}`);

  // Check if already admin
  if (user.role === "ADMIN") {
    console.log(`\n✓ User is already ADMIN. No changes needed.\n`);
    process.exit(0);
  }

  // Promote to admin
  const previousRole = user.role;
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log(`\n✅ SUCCESS: User promoted to ADMIN`);
  console.log(`\nDetails:`);
  console.log(`  User ID:       ${updatedUser.id}`);
  console.log(`  Email:         ${updatedUser.email}`);
  console.log(`  Previous role: ${previousRole}`);
  console.log(`  New role:      ${updatedUser.role}`);
  console.log(`\n📝 Note: Role changes take effect immediately (no re-login required).`);
  console.log(`\nYou can now access admin routes at /admin/*\n`);
}

main()
  .catch((error) => {
    console.error("\n❌ Unexpected error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
