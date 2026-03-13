import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkBusinessStatus() {
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      verificationStatus: true,
    },
  });

  console.log("Businesses:", JSON.stringify(businesses, null, 2));
}

checkBusinessStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
