import { reconcileBillingAccounts } from "../src/server/services/billing/billingReconciliation.service";
import prisma from "../src/lib/prisma";

async function main() {
  const result = await reconcileBillingAccounts();
  console.log(JSON.stringify(result, null, 2));
  if (result.mismatched > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
