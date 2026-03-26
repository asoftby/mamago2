import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function upsertSignal(slug: string, title: string, options: Array<{ value: string; label: string; order: number }>) {
  // Try to find first to get ID for options update
  // Since we don't have update/create logic nested easily with upsert for relations in this specific way without complex includes,
  // we'll do parent first then children.
  
  const def = await prisma.signalDefinition.upsert({
    where: { slug },
    update: { title, titleEn: title, isActive: true },
    create: { slug, title, titleEn: title, order: 0, isActive: true },
  })

  for (const o of options) {
    await prisma.signalOption.upsert({
      where: { definitionId_value: { definitionId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { definitionId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    })
  }
}

async function upsertFilter(slug: string, title: string, type: string, ui: string, options: Array<{ value: string; label: string; order: number }>) {
  const def = await prisma.filterDefinition.upsert({
    where: { slug },
    update: { title, type, ui, isActive: true },
    create: { slug, title, type, ui, order: 0, isActive: true },
  })

  for (const o of options) {
    await prisma.filterOption.upsert({
      where: { filterId_value: { filterId: def.id, value: o.value } },
      update: { label: o.label, order: o.order, isActive: true },
      create: { filterId: def.id, value: o.value, label: o.label, order: o.order, isActive: true },
    })
  }
}

async function main() {
  console.log('Seeding database...')

  // Signals
  console.log('Seeding Signals...')
  await upsertSignal("tempo", "Tempo", [
    { value: "slow", label: "Медленно", order: 1 },
    { value: "medium", label: "Умеренно", order: 2 },
    { value: "fast", label: "Быстро", order: 3 },
  ])

  await upsertSignal("energy", "Energy", [
    { value: "low", label: "Низкая", order: 1 },
    { value: "medium", label: "Средняя", order: 2 },
    { value: "high", label: "Высокая", order: 3 },
  ])

  /** Birthday Builder + ranking: taxonomy `signals.age` (public API `/api/public/signals/age`) */
  await upsertSignal("age", "Возраст", [
    { value: "0-3", label: "0–3 года", order: 1 },
    { value: "3-5", label: "3–5 лет", order: 2 },
    { value: "5-8", label: "6–10 лет", order: 3 },
    { value: "8-12", label: "10+ лет", order: 4 },
  ])

  // Filters
  console.log('Seeding Filters...')
  await upsertFilter("when", "Когда", "single", "tabs", [
    { value: "today", label: "Сегодня", order: 1 },
    { value: "tomorrow", label: "Завтра", order: 2 },
    { value: "weekend", label: "Выходные", order: 3 },
  ])

  await upsertFilter("age", "Возраст", "multi", "multi_tabs", [
    { value: "0-3", label: "0–3", order: 1 },
    { value: "3-5", label: "3–5", order: 2 },
    { value: "6-8", label: "6–8", order: 3 },
    { value: "9-12", label: "9–12", order: 4 },
  ])
  
  // Cities & Districts
  console.log('Seeding Cities & Districts...')
  
  const minsk = await prisma.city.upsert({
    where: { slug: "minsk" },
    update: {},
    create: {
      name: "Минск",
      slug: "minsk",
      lat: 53.9006,
      lng: 27.5590,
    }
  })

  const minskDistricts = [
    "Центральный",
    "Советский",
    "Первомайский",
    "Партизанский",
    "Заводской",
    "Ленинский",
    "Октябрьский",
    "Московский",
    "Фрунзенский",
  ]

  for (const name of minskDistricts) {
    await prisma.district.upsert({
      where: { cityId_name: { cityId: minsk.id, name } },
      update: {},
      create: {
        cityId: minsk.id,
        name,
      }
    })
  }

  // Minimal test data for SEO Control Center (Event entity pages)
  console.log("Seeding demo Event (Activity)...")
  const admin = await prisma.user.upsert({
    where: { email: "admin@mamago.local" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@mamago.local",
      passwordHash: "dev-only",
      role: "ADMIN",
    },
  })

  const demoPlace = await prisma.place.upsert({
    where: { slug: "demo-place" },
    update: {},
    create: {
      ownerUserId: admin.id,
      status: "PUBLISHED",
      slug: "demo-place",
      slugUpdatedAt: new Date(),
      title: "Demo Place",
      category: "park",
      shortDesc: "Демо-место для тестов SEO.",
      cityId: minsk.id,
      ageTags: [],
      visitFormats: [],
      activityTypes: [],
      locationSource: "MANUAL",
    },
  })

  console.log("Seeding demo Offer...")
  const demoOffer = await prisma.offer.upsert({
    where: { slug: "demo-offer-dlya-dnya-rozhdeniya" },
    update: {},
    create: {
      placeId: demoPlace.id,
      kind: "SERVICE",
      status: "PUBLISHED",
      publishedAt: new Date(),
      title: "Демо оффер для дня рождения",
      description: "Пакет для детского праздника: анимация + зал + угощения.",
      slug: "demo-offer-dlya-dnya-rozhdeniya",
      slugUpdatedAt: new Date(),
      seoRobots: "index,follow",
      priceFrom: 150,
      priceText: "от 150 BYN",
    },
  })

  console.log(`Demo offer id=${demoOffer.id} slug=${demoOffer.slug}`)

  const demoEvent = await prisma.activity.upsert({
    where: { slug: "detskiy-spektakl-v-minske" },
    update: {},
    create: {
      type: "EVENT",
      status: "PUBLISHED",
      ownerUserId: admin.id,
      title: "Детский спектакль в Минске",
      shortDesc: "Демо-событие для проверки slug/SEO editor/Schema/Redirects.",
      description: "<p>Тестовое описание события.</p>",
      ageTags: ["0-12"],
      scheduleMode: "MULTI_DATE",
      scheduleJson: {},
      placeId: demoPlace.id,
      cityId: minsk.id,
      slug: "detskiy-spektakl-v-minske",
      slugUpdatedAt: new Date(),
      seoRobots: "index,follow",
    },
  })

  await prisma.activitySession.createMany({
    data: [
      { activityId: demoEvent.id, startsAt: new Date(Date.now() + 24 * 3600 * 1000) },
      { activityId: demoEvent.id, startsAt: new Date(Date.now() + 48 * 3600 * 1000) },
    ],
    skipDuplicates: true,
  })

  console.log(`Demo event id=${demoEvent.id} slug=${demoEvent.slug}`)

  console.log("Seeding demo Route...")
  const demoRoute = await prisma.route.upsert({
    where: { slug: "demo-route-svisloch" },
    update: {},
    create: {
      slug: "demo-route-svisloch",
      slugUpdatedAt: new Date(),
      title: "Демо маршрут вдоль Свислочи",
      ageTags: ["3-7"],
      budgetLevel: "FREE",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      stops: {
        create: [
          { order: 1, note: "Старт у набережной", address: "Минск, набережная", photoUrl: null },
          { order: 2, note: "Остановка у кафе", address: "Минск, кафе", photoUrl: null },
        ],
      },
      seoRobots: "index,follow",
    },
  })
  console.log(`Demo route id=${demoRoute.id} slug=${demoRoute.slug}`)

  console.log("Seeding demo Article...")
  const demoArticle = await prisma.article.upsert({
    where: { slug: "demo-premium-article" },
    update: { status: "PUBLISHED", publishedAt: new Date("2026-03-10T00:00:00.000Z") },
    create: {
      slug: "demo-premium-article",
      slugUpdatedAt: new Date(),
      title: "Как провести выходные с детьми в Минске: 7 идей",
      subtitle: "От парков до мастер-классов — собрали лучшее для семейного уикенда",
      excerpt: "7 идей для выходных с детьми в Минске: парки, мастер-классы, музеи и маршруты.",
      status: "PUBLISHED",
      publishedAt: new Date("2026-03-10T00:00:00.000Z"),
      seoRobots: "index,follow",
    },
  })
  console.log(`Demo article id=${demoArticle.id} slug=${demoArticle.slug}`)
  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
