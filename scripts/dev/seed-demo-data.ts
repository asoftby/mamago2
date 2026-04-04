/**
 * scripts/dev/seed-demo-data.ts — DEV/STAGING ONLY
 *
 * Creates demo content for development and testing.
 * DO NOT run in production.
 *
 * Run: pnpm db:seed:demo
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🎭 Seeding DEMO DATA (dev/staging only)...");

  const minsk = await prisma.city.findUnique({ where: { slug: "minsk" } });
  if (!minsk) throw new Error("Run pnpm db:seed:system first — city 'minsk' not found.");

  // Admin user (dev only)
  const admin = await prisma.user.upsert({
    where: { email: "admin@mamago.local" },
    update: { role: "ADMIN" },
    create: { email: "admin@mamago.local", passwordHash: "dev-only", role: "ADMIN" },
  });

  // Demo Place
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
  });

  // Demo Offer
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
  });
  console.log(`  → Demo offer: ${demoOffer.slug}`);

  // Demo Event
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
  });
  await prisma.activitySession.createMany({
    data: [
      { activityId: demoEvent.id, startsAt: new Date(Date.now() + 24 * 3600 * 1000) },
      { activityId: demoEvent.id, startsAt: new Date(Date.now() + 48 * 3600 * 1000) },
    ],
    skipDuplicates: true,
  });
  console.log(`  → Demo event: ${demoEvent.slug}`);

  // Demo Route
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
  });
  console.log(`  → Demo route: ${demoRoute.slug}`);

  // Demo Article
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
  });
  console.log(`  → Demo article: ${demoArticle.slug}`);

  console.log("✅ Demo seed complete.");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
