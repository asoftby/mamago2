import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkCommercialData() {
  console.log("🔍 Checking commercial data...\n");

  const contracts = await prisma.businessContract.count();
  const placements = await prisma.businessPlacement.count();
  const servicePlacements = await prisma.businessServicePlacement.count();
  const notifications = await prisma.commercialNotification.count();

  console.log("📊 Data counts:");
  console.log(`  Contracts: ${contracts}`);
  console.log(`  Placements: ${placements}`);
  console.log(`  Service Placements: ${servicePlacements}`);
  console.log(`  Notifications: ${notifications}`);

  if (contracts > 0) {
    console.log("\n📄 Sample contract:");
    const contract = await prisma.businessContract.findFirst({
      include: {
        business: {
          select: {
            name: true,
          },
        },
      },
    });
    console.log(JSON.stringify(contract, null, 2));
  }
}

checkCommercialData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
