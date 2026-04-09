/**
 * Скрипт для синхронизации scheduleJson с сессиями
 * 
 * Использование:
 * pnpm tsx scripts/sync-event-schedule.ts <event-id>
 */

import prisma from "../src/lib/prisma";

async function main() {
  const eventId = process.argv[2];

  if (!eventId) {
    console.error("❌ Укажите ID события");
    console.log("\nИспользование:");
    console.log("  pnpm tsx scripts/sync-event-schedule.ts <event-id>");
    process.exit(1);
  }

  const event = await prisma.activity.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      scheduleJson: true,
      sessions: {
        select: {
          startsAt: true,
        },
        orderBy: { startsAt: "asc" },
      },
    },
  });

  if (!event) {
    console.error(`❌ Событие ${eventId} не найдено`);
    process.exit(1);
  }

  console.log(`\n📅 Событие: ${event.title}`);
  console.log(`   Сессий: ${event.sessions.length}`);

  if (event.sessions.length === 0) {
    console.error("❌ У события нет сессий");
    process.exit(1);
  }

  // Get the schedule JSON
  const scheduleJson = event.scheduleJson as any;
  
  if (!scheduleJson || typeof scheduleJson !== "object") {
    console.error("❌ scheduleJson не найден или имеет неверный формат");
    process.exit(1);
  }

  // Extract dates from sessions
  const sessionDates = event.sessions.map((s) => {
    const date = new Date(s.startsAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  console.log(`\n🔄 Обновляю scheduleJson...`);
  console.log(`   Старые даты: ${JSON.stringify(scheduleJson.dates)}`);
  console.log(`   Новые даты: ${JSON.stringify(sessionDates)}`);

  // Update dates in scheduleJson
  scheduleJson.dates = sessionDates;

  // Update timeSlots if they exist
  if (scheduleJson.timeSlots?.dates) {
    console.log(`\n🔄 Обновляю timeSlots...`);
    
    // Keep the first timeSlot structure but update dates
    const firstSlot = scheduleJson.timeSlots.dates[0];
    
    scheduleJson.timeSlots.dates = sessionDates.map((dateStr, index) => {
      const date = new Date(dateStr);
      const dayNames = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
      const monthNames = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
      
      const dayOfWeek = dayNames[date.getDay()];
      const day = date.getDate();
      const month = monthNames[date.getMonth()];
      
      return {
        id: `date-${Date.now()}-${index}`,
        label: `${day} ${month}, ${dayOfWeek}`,
        isoDate: dateStr,
        slots: firstSlot?.slots || [],
      };
    });
  }

  // Save updated scheduleJson
  await prisma.activity.update({
    where: { id: eventId },
    data: {
      scheduleJson: scheduleJson,
    },
  });

  console.log(`\n✅ scheduleJson обновлен`);
  console.log(`\n💡 Теперь форма редактирования должна показывать правильные даты`);
}

main()
  .catch((error) => {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
