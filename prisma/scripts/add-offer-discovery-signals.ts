/**
 * Скрипт для добавления Discovery сигналов для Offer
 * 
 * Добавляет 5 групп сигналов:
 * 1. discovery-activity (Чем будут заниматься)
 * 2. discovery-format (Где проходит)
 * 3. discovery-participation (Как проходит)
 * 4. discovery-intention (Для чего это подходит)
 * 5. discovery-feature (Особенности)
 * 
 * Запуск:
 * npx tsx prisma/scripts/add-offer-discovery-signals.ts
 */

import { PrismaClient, SignalDomain, SignalEntityType, SignalStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Начинаем добавление Discovery сигналов для Offer...\n");

  // 1. DISCOVERY-ACTIVITY
  console.log("📝 Создаем discovery-activity...");
  const activitySignal = await prisma.signalDefinition.upsert({
    where: { slug: "discovery-activity" },
    update: {
      title: "Чем будут заниматься",
      titleEn: "Activity",
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
      order: 10,
    },
    create: {
      slug: "discovery-activity",
      title: "Чем будут заниматься",
      titleEn: "Activity",
      order: 10,
      isActive: true,
      isSystem: true,
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
    },
  });

  const activityOptions = [
    { label: "Активно подвигаться", value: "active", order: 1 },
    { label: "Творчество", value: "creative", order: 2 },
    { label: "Обучение", value: "educational", order: 3 },
    { label: "Развлечения", value: "entertainment", order: 4 },
    { label: "Еда", value: "food", order: 5 },
    { label: "Спокойный отдых", value: "calm", order: 6 },
    { label: "Общение", value: "social", order: 7 },
  ];

  for (const option of activityOptions) {
    await prisma.signalDefinition.upsert({
      where: { slug: `discovery-activity-${option.value}` },
      update: {
        title: option.label,
        order: option.order,
        isActive: true,
        status: SignalStatus.ACTIVE,
      },
      create: {
        slug: `discovery-activity-${option.value}`,
        title: option.label,
        titleEn: option.value,
        order: option.order,
        isActive: true,
        isSystem: true,
        domain: SignalDomain.DISCOVERY,
        entityTypes: [SignalEntityType.OFFER],
        status: SignalStatus.ACTIVE,
        parentId: activitySignal.id,
      },
    });
  }
  console.log(`✅ discovery-activity создан с ${activityOptions.length} опциями\n`);

  // 2. DISCOVERY-FORMAT
  console.log("📝 Создаем discovery-format...");
  const formatSignal = await prisma.signalDefinition.upsert({
    where: { slug: "discovery-format" },
    update: {
      title: "Где проходит",
      titleEn: "Format",
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
      order: 20,
    },
    create: {
      slug: "discovery-format",
      title: "Где проходит",
      titleEn: "Format",
      order: 20,
      isActive: true,
      isSystem: true,
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
    },
  });

  const formatOptions = [
    { label: "В помещении", value: "indoor", order: 1 },
    { label: "На улице", value: "outdoor", order: 2 },
    { label: "Онлайн", value: "online", order: 3 },
  ];

  for (const option of formatOptions) {
    await prisma.signalDefinition.upsert({
      where: { slug: `discovery-format-${option.value}` },
      update: {
        title: option.label,
        order: option.order,
        isActive: true,
        status: SignalStatus.ACTIVE,
      },
      create: {
        slug: `discovery-format-${option.value}`,
        title: option.label,
        titleEn: option.value,
        order: option.order,
        isActive: true,
        isSystem: true,
        domain: SignalDomain.DISCOVERY,
        entityTypes: [SignalEntityType.OFFER],
        status: SignalStatus.ACTIVE,
        parentId: formatSignal.id,
      },
    });
  }
  console.log(`✅ discovery-format создан с ${formatOptions.length} опциями\n`);

  // 3. DISCOVERY-PARTICIPATION
  console.log("📝 Создаем discovery-participation...");
  const participationSignal = await prisma.signalDefinition.upsert({
    where: { slug: "discovery-participation" },
    update: {
      title: "Как проходит",
      titleEn: "Participation",
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
      order: 30,
    },
    create: {
      slug: "discovery-participation",
      title: "Как проходит",
      titleEn: "Participation",
      order: 30,
      isActive: true,
      isSystem: true,
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
    },
  });

  const participationOptions = [
    { label: "Группа", value: "group", order: 1 },
    { label: "Индивидуально", value: "individual", order: 2 },
    { label: "С родителями", value: "with-parents", order: 3 },
    { label: "Без родителей", value: "without-parents", order: 4 },
  ];

  for (const option of participationOptions) {
    await prisma.signalDefinition.upsert({
      where: { slug: `discovery-participation-${option.value}` },
      update: {
        title: option.label,
        order: option.order,
        isActive: true,
        status: SignalStatus.ACTIVE,
      },
      create: {
        slug: `discovery-participation-${option.value}`,
        title: option.label,
        titleEn: option.value,
        order: option.order,
        isActive: true,
        isSystem: true,
        domain: SignalDomain.DISCOVERY,
        entityTypes: [SignalEntityType.OFFER],
        status: SignalStatus.ACTIVE,
        parentId: participationSignal.id,
      },
    });
  }
  console.log(`✅ discovery-participation создан с ${participationOptions.length} опциями\n`);

  // 4. DISCOVERY-INTENTION
  console.log("📝 Создаем discovery-intention...");
  const intentionSignal = await prisma.signalDefinition.upsert({
    where: { slug: "discovery-intention" },
    update: {
      title: "Для чего это подходит",
      titleEn: "Intention",
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
      order: 40,
    },
    create: {
      slug: "discovery-intention",
      title: "Для чего это подходит",
      titleEn: "Intention",
      order: 40,
      isActive: true,
      isSystem: true,
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
    },
  });

  const intentionOptions = [
    { label: "Погулять", value: "walk", order: 1 },
    { label: "Поесть", value: "eat", order: 2 },
    { label: "Выпить кофе", value: "coffee", order: 3 },
    { label: "Активно провести время", value: "active-time", order: 4 },
    { label: "Спокойно отдохнуть", value: "relax", order: 5 },
    { label: "Провести время с ребёнком", value: "family-time", order: 6 },
    { label: "Посмотреть что-то интересное", value: "explore", order: 7 },
    { label: "Побыть на природе", value: "nature", order: 8 },
  ];

  for (const option of intentionOptions) {
    await prisma.signalDefinition.upsert({
      where: { slug: `discovery-intention-${option.value}` },
      update: {
        title: option.label,
        order: option.order,
        isActive: true,
        status: SignalStatus.ACTIVE,
      },
      create: {
        slug: `discovery-intention-${option.value}`,
        title: option.label,
        titleEn: option.value,
        order: option.order,
        isActive: true,
        isSystem: true,
        domain: SignalDomain.DISCOVERY,
        entityTypes: [SignalEntityType.OFFER],
        status: SignalStatus.ACTIVE,
        parentId: intentionSignal.id,
      },
    });
  }
  console.log(`✅ discovery-intention создан с ${intentionOptions.length} опциями\n`);

  // 5. DISCOVERY-FEATURE
  console.log("📝 Создаем discovery-feature...");
  const featureSignal = await prisma.signalDefinition.upsert({
    where: { slug: "discovery-feature" },
    update: {
      title: "Особенности",
      titleEn: "Features",
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
      order: 50,
    },
    create: {
      slug: "discovery-feature",
      title: "Особенности",
      titleEn: "Features",
      order: 50,
      isActive: true,
      isSystem: true,
      domain: SignalDomain.DISCOVERY,
      entityTypes: [SignalEntityType.OFFER],
      status: SignalStatus.ACTIVE,
    },
  });

  const featureOptions = [
    { label: "Есть пробное занятие", value: "trial", order: 1 },
    { label: "Скидка", value: "discount", order: 2 },
    { label: "Подарок", value: "bonus", order: 3 },
    { label: "С выездом", value: "on-site", order: 4 },
    { label: "Можно онлайн", value: "online-available", order: 5 },
    { label: "В выходные", value: "weekend", order: 6 },
    { label: "Срочно / сегодня", value: "instant", order: 7 },
    { label: "Ограниченное количество мест", value: "limited", order: 8 },
  ];

  for (const option of featureOptions) {
    await prisma.signalDefinition.upsert({
      where: { slug: `discovery-feature-${option.value}` },
      update: {
        title: option.label,
        order: option.order,
        isActive: true,
        status: SignalStatus.ACTIVE,
      },
      create: {
        slug: `discovery-feature-${option.value}`,
        title: option.label,
        titleEn: option.value,
        order: option.order,
        isActive: true,
        isSystem: true,
        domain: SignalDomain.DISCOVERY,
        entityTypes: [SignalEntityType.OFFER],
        status: SignalStatus.ACTIVE,
        parentId: featureSignal.id,
      },
    });
  }
  console.log(`✅ discovery-feature создан с ${featureOptions.length} опциями\n`);

  // Проверка результата
  console.log("📊 Проверяем созданные сигналы...\n");
  const signals = await prisma.signalDefinition.findMany({
    where: {
      slug: {
        in: [
          "discovery-activity",
          "discovery-format",
          "discovery-participation",
          "discovery-intention",
          "discovery-feature",
        ],
      },
    },
    include: {
      _count: {
        select: { children: true },
      },
    },
    orderBy: { order: "asc" },
  });

  console.log("✅ Созданные сигналы:");
  signals.forEach((signal) => {
    console.log(
      `   - ${signal.slug}: "${signal.title}" (${signal._count.children} опций) [${signal.domain}, ${signal.status}]`
    );
  });

  console.log("\n✨ Готово! Все Discovery сигналы для Offer успешно добавлены.");
}

main()
  .catch((e) => {
    console.error("❌ Ошибка:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
