import prisma from "../src/lib/prisma";

async function checkBalance() {
  try {
    // Найти бизнес с email asottey@gmail.com
    const business = await prisma.business.findFirst({
      where: {
        owner: {
          email: "asottey@gmail.com",
        },
      },
      include: {
        billingAccount: true,
        owner: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!business) {
      console.log("❌ Бизнес не найден");
      return;
    }

    console.log("✅ Бизнес найден:");
    console.log("  ID:", business.id);
    console.log("  Название:", business.name);
    console.log("  Owner email:", business.owner?.email);
    console.log("  Owner ID:", business.ownerUserId);
    console.log("");

    if (!business.billingAccount) {
      console.log("❌ BillingAccount не найден");
      return;
    }

    console.log("✅ BillingAccount найден:");
    console.log("  ID:", business.billingAccount.id);
    console.log("  Баланс:", business.billingAccount.depositBalance.toString(), "BYN");
    console.log("  Статус:", business.billingAccount.status);
    console.log("  Валюта:", business.billingAccount.currency);

    // Проверить транзакции
    const transactions = await prisma.billingTransaction.findMany({
      where: {
        billingAccountId: business.billingAccount.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    console.log("");
    console.log("📊 Последние транзакции:");
    if (transactions.length === 0) {
      console.log("  (нет транзакций)");
    } else {
      transactions.forEach((tx) => {
        console.log(`  - ${tx.type}: ${tx.amount.toString()} BYN (${tx.status})`);
      });
    }
  } catch (error) {
    console.error("Ошибка:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBalance();
