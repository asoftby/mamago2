/**
 * prisma/seed.ts — SYSTEM DATA ONLY
 *
 * Data Policy:
 * - This seed creates/maintains SYSTEM entities only.
 * - All upserts are idempotent (safe to run multiple times).
 * - isSystem = true marks entities as protected from deletion.
 * - Demo/content data lives in scripts/dev/seed-demo-data.ts
 *
 * Run: pnpm db:seed:system
 */

import { PrismaClient, type OccasionType, type SignalDomain, type SignalEntityType } from "@prisma/client";
import { seedPlaceCategories } from "./seed/place-categories";
import { seedEventCategories } from "./seed/event-categories";

const prisma = new PrismaClient();

async function upsertSignal(
  slug: string,
  title: string,
  order: number,
  options: Array<{ value: string; label: string; order: number }>,
) {
  const def = await prisma.signalDefinition.upsert({
    where: { slug },
    update: { title, titleEn: title, isActive: true, isSystem: true, order },
    create: { slug, title, titleEn: title, order, isActive: true, isSystem: true },
  });

  for (const o of options) {
    await prisma.signalOption.upsert({
      where: { definitionId_value: { definitionId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { definitionId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    });
  }
}

async function upsertDomainSignal(
  slug: string,
  title: string,
  domain: "PROFILE" | "DISCOVERY" | "RECOMMENDATION",
  order: number,
) {
  return prisma.signalDefinition.upsert({
    where: { slug },
    update: {
      title,
      titleEn: title,
      domain,
      order,
      isActive: true,
      isSystem: true,
      parentId: null,
      status: "ACTIVE",
      entityTypes: [],
    },
    create: {
      slug,
      title,
      titleEn: title,
      domain,
      order,
      isActive: true,
      isSystem: true,
      parentId: null,
      status: "ACTIVE",
      entityTypes: [],
    },
  });
}

async function upsertSignalWithDomain(
  slug: string,
  title: string,
  domain: SignalDomain,
  entityTypes: SignalEntityType[],
  order: number,
  options: Array<{ value: string; label: string; order: number }> = [],
  parentSlug?: string,
) {
  // Найдем родителя если указан
  let parentId: string | null = null;
  if (parentSlug) {
    const parent = await prisma.signalDefinition.findUnique({
      where: { slug: parentSlug },
    });
    if (parent) {
      parentId = parent.id;
    }
  }

  const def = await prisma.signalDefinition.upsert({
    where: { slug },
    update: {
      title,
      titleEn: title,
      domain,
      entityTypes,
      parentId,
      order,
      isActive: true,
      isSystem: true,
      status: "ACTIVE",
    },
    create: {
      slug,
      title,
      titleEn: title,
      domain,
      entityTypes,
      parentId,
      order,
      isActive: true,
      isSystem: true,
      status: "ACTIVE",
    },
  });

  // Создаем опции если есть
  for (const o of options) {
    await prisma.signalOption.upsert({
      where: { definitionId_value: { definitionId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { definitionId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    });
  }

  return def;
}

async function upsertSignalGroupRoot(slug: string, title: string, order: number) {
  return prisma.signalDefinition.upsert({
    where: { slug },
    update: {
      title,
      titleEn: title,
      order,
      isActive: true,
      isSystem: true,
      parentId: null,
    },
    create: {
      slug,
      title,
      titleEn: title,
      order,
      isActive: true,
      isSystem: true,
      parentId: null,
    },
  });
}

async function upsertSignalGroupChild(
  parentId: string,
  slug: string,
  title: string,
  order: number,
) {
  await prisma.signalDefinition.upsert({
    where: { slug },
    update: {
      title,
      titleEn: title,
      parentId,
      order,
      isActive: true,
      isSystem: true,
    },
    create: {
      slug,
      title,
      titleEn: title,
      parentId,
      order,
      isActive: true,
      isSystem: true,
    },
  });
}

const APPROVED_OCCASIONS: Array<{
  slug: string;
  name: string;
  type: OccasionType;
  sortOrder: number;
}> = [
  { slug: "new-year", name: "Новый год", type: "HOLIDAY", sortOrder: 10 },
  { slug: "womens-day", name: "8 марта", type: "HOLIDAY", sortOrder: 20 },
  { slug: "maslenitsa", name: "Масленица", type: "HOLIDAY", sortOrder: 30 },
  { slug: "easter", name: "Пасха", type: "HOLIDAY", sortOrder: 40 },
  { slug: "halloween", name: "Хэллоуин", type: "HOLIDAY", sortOrder: 50 },
  { slug: "childrens-day", name: "День защиты детей", type: "HOLIDAY", sortOrder: 60 },
  { slug: "kupalle", name: "Купалье", type: "HOLIDAY", sortOrder: 70 },
  { slug: "school-holidays", name: "Каникулы", type: "SEASON", sortOrder: 80 },
  { slug: "back-to-school", name: "1 сентября", type: "EVENT", sortOrder: 90 },
  { slug: "graduation", name: "Выпускной", type: "EVENT", sortOrder: 100 },
  { slug: "summer-cinema", name: "Летние кинопросмотры", type: "SEASON", sortOrder: 110 },
  { slug: "birthday", name: "День рождения", type: "FAMILY", sortOrder: 120 },
];

async function upsertFilter(
  slug: string,
  title: string,
  type: string,
  ui: string,
  orderIndex: number,
  options: Array<{ value: string; label: string; order: number }>,
) {
  const def = await prisma.filterDefinition.upsert({
    where: { slug },
    update: { title, type, ui, isActive: true, isSystem: true, orderIndex },
    create: { slug, title, type, ui, order: orderIndex, orderIndex, isActive: true, isSystem: true },
  });

  for (const o of options) {
    await prisma.filterOption.upsert({
      where: { filterId_value: { filterId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, orderIndex: o.order, isActive: true },
      create: { filterId: def.id, value: o.value, label: o.label, order: o.order, orderIndex: o.order, isActive: true },
    });
  }
}

async function main() {
  console.log("🌱 Seeding SYSTEM DATA...");

  // ── Signals (SYSTEM) ──────────────────────────────────────────────────────
  console.log("  → Signals");

  // Доменные корневые узлы
  await upsertDomainSignal("domain-profile", "Профиль", "PROFILE", -3);
  await upsertDomainSignal("domain-discovery", "Discovery", "DISCOVERY", -2);
  await upsertDomainSignal("domain-recommendation", "Рекомендации", "RECOMMENDATION", -1);

  // ═══ PROFILE DOMAIN ═══
  await upsertSignalWithDomain("age", "Возраст", "PROFILE", ["USER"], 1, [
    { value: "0-3",  label: "0–3 года",  order: 1 },
    { value: "3-5",  label: "3–5 лет",   order: 2 },
    { value: "5-8",  label: "6–10 лет",  order: 3 },
    { value: "8-12", label: "10+ лет",   order: 4 },
  ]);

  await upsertSignalWithDomain("interests", "Интересы", "PROFILE", ["USER"], 2, [
    { value: "sport", label: "Спорт", order: 1 },
    { value: "music", label: "Музыка", order: 2 },
    { value: "art", label: "Рисование", order: 3 },
    { value: "dance", label: "Танцы", order: 4 },
    { value: "animals", label: "Животные", order: 5 },
    { value: "books", label: "Книги", order: 6 },
    { value: "construction", label: "Конструкторы", order: 7 },
    { value: "science", label: "Наука", order: 8 },
    { value: "nature", label: "Природа", order: 9 },
    { value: "technology", label: "Техника", order: 10 },
    { value: "creativity", label: "Творчество", order: 11 },
    { value: "active-games", label: "Активные игры", order: 12 },
    { value: "quiet-activities", label: "Спокойные занятия", order: 13 },
  ]);

  // Preferences группа (корень + дети)
  const preferencesRoot = await upsertSignalWithDomain("preferences", "Предпочтения", "PROFILE", ["USER"], 3);
  await upsertSignalWithDomain("preferences-aesthetics", "Эстетика", "PROFILE", ["USER"], 1, [], "preferences");
  await upsertSignalWithDomain("preferences-coffee", "Кофе", "PROFILE", ["USER"], 2, [], "preferences");
  await upsertSignalWithDomain("preferences-family", "Семейно", "PROFILE", ["USER"], 3, [], "preferences");

  // ═══ DISCOVERY DOMAIN ═══
  // Format группа
  const formatRoot = await upsertSignalWithDomain("format", "Формат", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 1);
  await upsertSignalWithDomain("format-indoor", "В помещении", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 1, [], "format");
  await upsertSignalWithDomain("format-outdoor", "На улице", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 2, [], "format");
  await upsertSignalWithDomain("format-online", "Онлайн", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 3, [], "format");

  // Activity группа
  const activityRoot = await upsertSignalWithDomain("activity", "Активность", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 2);
  await upsertSignalWithDomain("activity-active", "Активно", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 1, [], "activity");
  await upsertSignalWithDomain("activity-creative", "Творчество", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 2, [], "activity");
  await upsertSignalWithDomain("activity-educational", "Образовательно", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 3, [], "activity");
  await upsertSignalWithDomain("activity-entertainment", "Развлечения", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 4, [], "activity");
  await upsertSignalWithDomain("activity-food", "Еда", "DISCOVERY", ["PLACE", "EVENT", "ROUTE", "OFFER"], 5, [], "activity");
  await upsertSignalWithDomain("activity-calm", "Спокойно", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 6, [], "activity");
  await upsertSignalWithDomain("activity-social", "Социально", "DISCOVERY", ["PLACE", "EVENT", "ROUTE"], 7, [], "activity");

  // ═══ RECOMMENDATION DOMAIN ═══
  await upsertSignalWithDomain("tempo", "Tempo", "RECOMMENDATION", [], 1, [
    { value: "slow",   label: "Медленно",  order: 1 },
    { value: "medium", label: "Умеренно",  order: 2 },
    { value: "fast",   label: "Быстро",    order: 3 },
  ]);

  await upsertSignalWithDomain("energy", "Energy", "RECOMMENDATION", [], 2, [
    { value: "low",    label: "Низкая",    order: 1 },
    { value: "medium", label: "Средняя",   order: 2 },
    { value: "high",   label: "Высокая",   order: 3 },
  ]);

  // ═══ LEGACY SIGNALS (для обратной совместимости) ═══
  // Старые сигналы остаются для совместимости, но помечены как DEPRECATED в миграции
  const leisureRoot = await upsertSignalGroupRoot("leisure-format", "Формат досуга", 11);
  await upsertSignalGroupChild(leisureRoot.id, "leisure-format-home", "Дома", 1);
  await upsertSignalGroupChild(leisureRoot.id, "leisure-format-outdoor", "На улице", 2);
  await upsertSignalGroupChild(leisureRoot.id, "leisure-format-mixed", "Смешанный", 3);

  // ── Filters (SYSTEM) ──────────────────────────────────────────────────────
  console.log("  → Filters");

  await upsertFilter("when", "Когда", "single", "tabs", 0, [
    { value: "today",   label: "Сегодня",   order: 1 },
    { value: "tomorrow",label: "Завтра",    order: 2 },
    { value: "weekend", label: "Выходные",  order: 3 },
  ]);

  await upsertFilter("age", "Возраст", "multi", "multi_tabs", 1, [
    { value: "0-3",  label: "0–3",  order: 1 },
    { value: "3-5",  label: "3–5",  order: 2 },
    { value: "6-8",  label: "6–8",  order: 3 },
    { value: "9-12", label: "9–12", order: 4 },
  ]);

  // ── Cities (SYSTEM) ───────────────────────────────────────────────────────
  console.log("  → Cities");

  const minsk = await prisma.city.upsert({
    where: { slug: "minsk" },
    update: {},
    create: {
      name: "Минск",
      slug: "minsk",
      lat: 53.9006,
      lng: 27.5590,
      centerLat: 53.9006,
      centerLng: 27.5590,
      radiusKm: 40,
      hasMetro: true,
      metroMaxDistanceM: 2500,
    },
  });

  const minskDistricts = [
    "Центральный", "Советский", "Первомайский", "Партизанский",
    "Заводской", "Ленинский", "Октябрьский", "Московский", "Фрунзенский",
  ];

  for (const name of minskDistricts) {
    await prisma.district.upsert({
      where: { cityId_name: { cityId: minsk.id, name } },
      update: {},
      create: { cityId: minsk.id, name },
    });
  }

  // Населённые пункты Минской области — лента /minsk/kuda может включать их (см. discoveryHubExpand)
  await prisma.city.upsert({
    where: { slug: "minskaya-oblast" },
    update: {},
    create: {
      name: "Минская область",
      slug: "minskaya-oblast",
      centerLat: 53.9,
      centerLng: 27.5667,
      radiusKm: 120,
      hasMetro: false,
    },
  });
  await prisma.city.upsert({
    where: { slug: "marina-gorka" },
    update: {},
    create: {
      name: "Марьина Горка",
      slug: "marina-gorka",
      lat: 53.5103,
      lng: 28.1478,
      centerLat: 53.5103,
      centerLng: 28.1478,
      radiusKm: 15,
      hasMetro: false,
    },
  });

  console.log("  → Genres (by EventCategory)");
  const kinoCat = await prisma.eventCategory.findFirst({
    where: { parentId: null, slug: { in: ["kino", "cinema", "movie", "movies"] } },
  });
  const spektakliCat = await prisma.eventCategory.findFirst({
    where: {
      parentId: null,
      slug: {
        in: [
          "spektakli",
          "spectacle",
          "teatr",
          "theater",
          "detskiy-teatr",
          "detskiy-spektakl",
        ],
      },
    },
  });

  const kinoGenres: Array<{ slug: string; name: string; sortOrder: number }> = [
    { slug: "animation", name: "Мультфильм", sortOrder: 10 },
    { slug: "comedy", name: "Комедия", sortOrder: 20 },
    { slug: "adventure", name: "Приключения", sortOrder: 30 },
    { slug: "fantasy", name: "Фэнтези", sortOrder: 40 },
    { slug: "family", name: "Семейный", sortOrder: 50 },
  ];

  const spektakliGenres: Array<{ slug: string; name: string; sortOrder: number }> = [
    { slug: "puppet", name: "Кукольный", sortOrder: 10 },
    { slug: "musical", name: "Музыкальный", sortOrder: 20 },
    { slug: "interactive", name: "Интерактивный", sortOrder: 30 },
    { slug: "immersive", name: "Иммерсивный", sortOrder: 40 },
    { slug: "family-show", name: "Семейный", sortOrder: 50 },
  ];

  if (kinoCat) {
    for (const g of kinoGenres) {
      await prisma.genre.upsert({
        where: { categoryId_slug: { categoryId: kinoCat.id, slug: g.slug } },
        update: { name: g.name, sortOrder: g.sortOrder, isActive: true },
        create: {
          categoryId: kinoCat.id,
          slug: g.slug,
          name: g.name,
          sortOrder: g.sortOrder,
          isActive: true,
        },
      });
    }
  } else {
    console.warn("   (skip kino genres: root category kino/cinema not found)");
  }

  if (spektakliCat) {
    for (const g of spektakliGenres) {
      await prisma.genre.upsert({
        where: { categoryId_slug: { categoryId: spektakliCat.id, slug: g.slug } },
        update: { name: g.name, sortOrder: g.sortOrder, isActive: true },
        create: {
          categoryId: spektakliCat.id,
          slug: g.slug,
          name: g.name,
          sortOrder: g.sortOrder,
          isActive: true,
        },
      });
    }
  } else {
    console.warn("   (skip spektakli genres: root category not found)");
  }

  console.log("  → EventCategory: program flags");
  const setFlagsBySlugs = async (
    slugs: string[],
    flags: { supportsProgram?: boolean; selectableInProgram?: boolean },
  ) => {
    const rows = await prisma.eventCategory.findMany({
      where: { publicationType: "EVENT", slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    if (rows.length === 0) {
      console.warn(`   (skip program flags: no categories found for slugs: ${slugs.join(", ")})`);
      return;
    }
    await prisma.eventCategory.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: flags,
    });
  };

  // Containers: if selected as primary → show program block
  await setFlagsBySlugs(["festival", "fest", "festivali", "festiv", "festivaly"], {
    supportsProgram: true,
    selectableInProgram: false,
  });
  await setFlagsBySlugs(["market", "yarmarka", "bazaar"], {
    supportsProgram: true,
    selectableInProgram: false,
  });
  await setFlagsBySlugs(["forum"], { supportsProgram: true, selectableInProgram: false });

  // Allowed inside program
  await setFlagsBySlugs(["kino", "cinema", "movie", "movies"], {
    supportsProgram: false,
    selectableInProgram: true,
  });
  await setFlagsBySlugs(["vystavka", "exhibition"], { selectableInProgram: true });
  await setFlagsBySlugs(["master-klass", "masterclass"], { selectableInProgram: true });
  await setFlagsBySlugs(["kviz", "quiz"], { selectableInProgram: true });
  await setFlagsBySlugs(["lekciya", "lecture"], { selectableInProgram: true });
  await setFlagsBySlugs(["spektakli", "spectacle", "teatr", "theater"], { selectableInProgram: true });
  await setFlagsBySlugs(["koncert", "concert"], { selectableInProgram: true });

  console.log("  → Occasions");
  for (const o of APPROVED_OCCASIONS) {
    await prisma.occasion.upsert({
      where: { slug: o.slug },
      update: {
        name: o.name,
        type: o.type,
        sortOrder: o.sortOrder,
        isActive: true,
      },
      create: {
        slug: o.slug,
        name: o.name,
        type: o.type,
        sortOrder: o.sortOrder,
        isActive: true,
      },
    });
  }

  // ── Place Categories ──────────────────────────────────────────────────────
  await seedPlaceCategories();

  // ── Event Categories ──────────────────────────────────────────────────────
  await seedEventCategories();

  console.log("✅ System seed complete.");
  console.log("   Demo/content data: run pnpm db:seed:demo");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
