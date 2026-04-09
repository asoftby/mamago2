/**
 * Backfill verificationStatus from legacy status field
 * Run once: pnpm tsx prisma/scripts/backfillVerificationStatus.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting verificationStatus backfill...");

  const result = await prisma.$executeRaw`
    UPDATE "Business"
    SET "verificationStatus" = CASE
      WHEN "verificationStatus" IS NOT NULL AND "verificationStatus" IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') 
        THEN "verificationStatus"
      WHEN "status" IN ('PENDING_VERIFICATION', 'PENDING_REVIEW') 
        THEN 'PENDING'::"BusinessVerificationStatus"
      WHEN "status" = 'APPROVED' 
        THEN 'APPROVED'::"BusinessVerificationStatus"
      WHEN "status" = 'REJECTED' 
        THEN 'REJECTED'::"BusinessVerificationStatus"
      ELSE 'DRAFT'::"BusinessVerificationStatus"
    END
    WHERE "verificationStatus" IS NULL 
       OR "verificationStatus" NOT IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')
  `;

  console.log(`Updated ${result} business records`);
  console.log("Backfill complete!");
}

main()
  .catch((e) => {
    console.error("Error during backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
