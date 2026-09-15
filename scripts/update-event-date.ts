/**
 * Скрипт для обновления даты события
 * 
 * Использование:
 * pnpm tsx scripts/update-event-date.ts <event-id> <new-date>
 * pnpm tsx scripts/update-event-date.ts cmnipdtte0007ws9tuz1tqrs4 2026-04-10
 */

import prisma from "../src/lib/prisma";

async function main() {
  const eventId = process.argv[2];
  const newDateStr = process.argv[3];

  if (!eventId || !newDateStr) {
    console.error("❌ Укажите ID события и новую дату");
    console.log("\nИспользование:");
    console.log("  pnpm tsx scripts/update-event-date.ts <event-id> <new-date>");
    console.log("\nПример:");
    console.log("  pnpm tsx scripts/update-event-date.ts cmnipdtte0007ws9tuz1tqrs4 2026-04-10");
    process.exit(1);
  }

  const event = await prisma.activity.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      nextOccurrenceAt: true,
    },
  });

  if (!event) {
    console.error(`❌ Событие ${eventId} не найдено`);
    process.exit(1);
  }

  console.log(`\n📅 Событие: ${event.title}`);
  console.log(`   Текущая дата: ${event.nextOccurrenceAt ? new Date(event.nextOccurrenceAt).toLocaleDateString("ru-RU") : "не установлена"}`);

  // Парсим новую дату
  const newDate = new Date(newDateStr);
  if (isNaN(newDate.getTime())) {
    console.error(`❌ Неверный формат даты: ${newDateStr}`);
    console.log("   Используйте формат: YYYY-MM-DD (например, 2026-04-10)");
    process.exit(1);
  }

  console.log(`   Новая дата: ${newDate.toLocaleDateString("ru-RU")}`);

  // Проверяем сессии ДО любых записей: ActivitySession-строки с непустым
  // source созданы импорт-пайплайном (ABWS) — их даты приходят из
  // источника, у них есть externalId/цена/buyUrl, которые этот скрипт не
  // восстановит. Схлопывание всех сессий в одну дату в принципе
  // некорректно для мульти-сессионного импортного события, поэтому
  // полностью отказываем ДО записи nextOccurrenceAt — не оставляем
  // событие в промежуточном состоянии, где дата поменялась, а сессии нет
  // (BACKLOG-154 row #5).
  const sessions = await prisma.activitySession.findMany({
    where: { activityId: eventId },
    orderBy: { startsAt: "asc" },
  });
  const importedSessions = sessions.filter((s) => s.source != null);
  if (importedSessions.length > 0) {
    console.error(
      `❌ У события есть импортные сессии (${importedSessions.length} из ${sessions.length}, source: ${
        [...new Set(importedSessions.map((s) => s.source))].join(", ")
      }) — этот скрипт их не трогает.`,
    );
    console.log("   Импортные даты нельзя менять через этот инструмент — они приходят из источника.");
    process.exit(1);
  }

  // Обновляем nextOccurrenceAt
  await prisma.activity.update({
    where: { id: eventId },
    data: {
      nextOccurrenceAt: newDate,
    },
  });

  console.log(`\n🔄 Обновляю ${sessions.length} сессий...`);

  for (const session of sessions) {
    await prisma.activitySession.update({
      where: { id: session.id },
      data: {
        startsAt: newDate,
      },
    });
  }

  console.log(`✅ Дата события обновлена на ${newDate.toLocaleDateString("ru-RU")}`);
  console.log(`\n💡 Теперь событие должно быть видно на странице /minsk/events`);
}

main()
  .catch((error) => {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
