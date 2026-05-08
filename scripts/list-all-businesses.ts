import prisma from "../src/lib/prisma";

async function listBusinesses() {
  try {
    const businesses = await prisma.business.findMany({
      include: {
        owner: {
          select: {
            email: true,
          },
        },
        billingAccount: {
          select: {
            id: true,
            depositBalance: true,
            status: true,
          },
        },
      },
      take: 10,
    });

    console.log(`📋 Найдено бизнесов: ${businesses.length}`);
    console.log("");

    businesses.forEach((business, index) => {
      console.log(`${index + 1}. ${business.name}`);
      console.log(`   ID: ${business.id}`);
      console.log(`   Owner: ${business.owner?.email || "нет"}`);
      console.log(`   Owner ID: ${business.ownerUserId || "нет"}`);
      
      if (business.billingAccount) {
        console.log(`   ✅ Billing Account: ${business.billingAccount.depositBalance.toString()} BYN (${business.billingAccount.status})`);
      } else {
        console.log(`   ❌ Billing Account: не создан`);
      }
      console.log("");
    });
  } catch (error) {
    console.error("Ошибка:", error);
  } finally {
    await prisma.$disconnect();
  }
}

listBusinesses();
