/**
 * Скрипт для проверки и изменения роли пользователя
 * 
 * Использование:
 * pnpm tsx scripts/check-user-role.ts <email>
 * pnpm tsx scripts/check-user-role.ts <email> --set-admin
 */

import prisma from "../src/lib/prisma";
import { Role } from "@prisma/client";

async function main() {
  const email = process.argv[2];
  const setAdmin = process.argv.includes("--set-admin");

  if (!email) {
    console.error("❌ Укажите email пользователя");
    console.log("\nИспользование:");
    console.log("  pnpm tsx scripts/check-user-role.ts <email>");
    console.log("  pnpm tsx scripts/check-user-role.ts <email> --set-admin");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      business: true,
    },
  });

  if (!user) {
    console.error(`❌ Пользователь с email ${email} не найден`);
    process.exit(1);
  }

  console.log("\n📋 Информация о пользователе:");
  console.log(`   Email: ${user.email}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Роль: ${user.role}`);
  console.log(`   Бизнес: ${user.business?.name || "не указан"}`);

  if (setAdmin && user.role !== Role.ADMIN) {
    console.log("\n🔄 Изменяю роль на ADMIN...");
    await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
    });
    console.log("✅ Роль изменена на ADMIN");
    console.log("\n💡 Теперь вы можете публиковать события без модерации");
  } else if (setAdmin) {
    console.log("\n✅ Пользователь уже имеет роль ADMIN");
  }

  // Проверяем события пользователя
  const events = await prisma.activity.findMany({
    where: {
      ownerUserId: user.id,
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (events.length > 0) {
    console.log("\n📅 События пользователя:");
    for (const event of events) {
      const statusEmoji = 
        event.status === "PUBLISHED" ? "✅" :
        event.status === "PENDING" ? "⏳" :
        event.status === "PENDING_UPDATE" ? "🔄" :
        event.status === "DRAFT" ? "📝" : "❓";
      console.log(`   ${statusEmoji} ${event.title} (${event.status})`);
    }
  } else {
    console.log("\n📅 У пользователя нет событий");
  }

  console.log("\n");
}

main()
  .catch((error) => {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
