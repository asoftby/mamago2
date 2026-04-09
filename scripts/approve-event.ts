/**
 * Скрипт для одобрения события (изменение статуса на PUBLISHED)
 * 
 * Использование:
 * pnpm tsx scripts/approve-event.ts <event-id>
 * pnpm tsx scripts/approve-event.ts --all-pending
 */

import prisma from "../src/lib/prisma";
import { ContentStatus } from "@prisma/client";
import { ensurePublishedActivityHasSlug } from "../src/lib/slug/publishSlugGuards";

async function approveEvent(eventId: string) {
  const event = await prisma.activity.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
    },
  });

  if (!event) {
    console.error(`❌ Событие ${eventId} не найдено`);
    return false;
  }

  if (event.status === ContentStatus.PUBLISHED) {
    console.log(`✅ Событие "${event.title}" уже опубликовано`);
    return true;
  }

  console.log(`🔄 Публикую событие "${event.title}"...`);
  
  await prisma.activity.update({
    where: { id: eventId },
    data: { status: ContentStatus.PUBLISHED },
  });

  await ensurePublishedActivityHasSlug(eventId);

  const updated = await prisma.activity.findUnique({
    where: { id: eventId },
    select: { slug: true },
  });

  console.log(`✅ Событие опубликовано`);
  console.log(`   Slug: ${updated?.slug || "не установлен"}`);
  
  return true;
}

async function main() {
  const eventId = process.argv[2];
  const allPending = process.argv.includes("--all-pending");

  if (!eventId && !allPending) {
    console.error("❌ Укажите ID события или флаг --all-pending");
    console.log("\nИспользование:");
    console.log("  pnpm tsx scripts/approve-event.ts <event-id>");
    console.log("  pnpm tsx scripts/approve-event.ts --all-pending");
    process.exit(1);
  }

  if (allPending) {
    console.log("🔍 Ищу события в статусе PENDING...\n");
    
    const pendingEvents = await prisma.activity.findMany({
      where: {
        status: ContentStatus.PENDING,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (pendingEvents.length === 0) {
      console.log("✅ Нет событий в статусе PENDING");
      return;
    }

    console.log(`📋 Найдено событий: ${pendingEvents.length}\n`);

    for (const event of pendingEvents) {
      await approveEvent(event.id);
      console.log("");
    }

    console.log(`✅ Одобрено событий: ${pendingEvents.length}`);
  } else {
    await approveEvent(eventId);
  }
}

main()
  .catch((error) => {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
