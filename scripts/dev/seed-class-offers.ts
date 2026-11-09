/**
 * DEV ONLY: 45 synthetic, clearly labelled class Offers (5 per public class chip
 * other than the aggregate "all"). No production publishing or real bookings.
 *
 * Run on the deployed DEV host, using its normal environment:
 *   SEED_DEV_CLASSES_CONFIRM=DEV_ONLY \
 *   SEED_DEV_CLASSES_EXPECTED_DB=<database name> \
 *   pnpm exec tsx scripts/dev/seed-class-offers.ts --apply
 *
 * The script refuses to run without explicit DEV fingerprint confirmation.
 * It is additive/idempotent; it never overwrites real Offers.
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PLACE_SLUG = "dev-classes-fixture-place";
const USER_EMAIL = "dev-class-fixtures@mamago.invalid";

const categories = {
  clubs: ["Шахматный кружок", "Юные исследователи", "Робототехника", "Театральный кружок", "Клуб настольных игр"],
  sections: ["Школа плавания", "Детская гимнастика", "Скалолазание", "Футбольная секция", "Школа тенниса"],
  courses: ["Английский для детей", "Основы программирования", "Математика с интересом", "Курс фотографии", "Курс естественных наук"],
  camps: ["Городской научный лагерь", "Творческий дневной лагерь", "Спортивный лагерь", "Лагерь юных инженеров", "Летняя театральная смена"],
  workshops: ["Лепка из глины", "Мастер-класс по рисунку", "Кулинарный мастер-класс", "Сборка робота", "Создание мультфильма"],
  sport: ["Йога для детей", "Каратэ для начинающих", "Баскетбол", "Роликовая школа", "Детская лёгкая атлетика"],
  creativity: ["Акварельная живопись", "Декоративное искусство", "Школа керамики", "Дизайн для детей", "Аппликации и коллажи"],
  music: ["Фортепиано", "Гитара с нуля", "Детский вокал", "Музыкальные игры", "Ансамбль ударных"],
  dance: ["Современные танцы", "Балет для начинающих", "Хип-хоп для детей", "Народные танцы", "Танцевальная ритмика"],
} as const;

type Category = keyof typeof categories;

const covers: Record<Category, string> = {
  clubs: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900&q=80",
  sections: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=900&q=80",
  courses: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=900&q=80",
  camps: "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=900&q=80",
  workshops: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=900&q=80",
  sport: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80",
  creativity: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=900&q=80",
  music: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=900&q=80",
  dance: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=900&q=80",
};

async function assertDevTarget() {
  if (process.env.APP_ENV?.trim().toLowerCase() !== "dev") {
    throw new Error("Refusing seed: APP_ENV must be dev (not NODE_ENV).");
  }
  if (process.env.SEED_DEV_CLASSES_CONFIRM !== "DEV_ONLY") {
    throw new Error("Refusing seed: explicit SEED_DEV_CLASSES_CONFIRM=DEV_ONLY required.");
  }
  const publicUrl = process.env.APP_PUBLIC_URL;
  if (!publicUrl || new URL(publicUrl).hostname !== "dev.mamago.by") {
    throw new Error("Refusing seed: APP_PUBLIC_URL must point to dev.mamago.by.");
  }
  const expectedDb = process.env.SEED_DEV_CLASSES_EXPECTED_DB?.trim();
  if (!expectedDb) throw new Error("Refusing seed: expected DEV database name is required.");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Refusing seed: DATABASE_URL is missing.");
  const databaseUrl = new URL(connectionString);
  if (/prod(uction)?/i.test(databaseUrl.hostname + databaseUrl.pathname)) {
    throw new Error("Refusing seed: database host/name looks like production.");
  }
  const names = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (names[0]?.name !== expectedDb) {
    throw new Error("Refusing seed: connected database name differs from expected DEV name.");
  }
}

function makeFixtures(cityId: string, territoryId: string, placeId: string): Prisma.OfferCreateManyInput[] {
  const publishedAt = new Date();
  return (Object.entries(categories) as Array<[Category, readonly string[]]>).flatMap(([chip, titles]) =>
    titles.map((title, index): Prisma.OfferCreateManyInput => {
      const isFree = index === 0;
      const ageMinMonths = 36 + (index % 4) * 12;
      return {
        cityId,
        territoryId,
        placeId,
        slug: `dev-class-${chip}-${index + 1}`,
        slugUpdatedAt: publishedAt,
        kind: "SERVICE",
        productType: chip === "camps" ? "CAMP" : chip === "workshops" ? "ONE_TIME_ACTIVITY" : "REGULAR_ACTIVITY",
        classChipSlugs: [chip],
        title: `[DEV] ${title}`,
        description: "Тестовое предложение для проверки каталога «Занятия» на DEV. Не является реальной записью и не принимает заявки.",
        coverImage: covers[chip],
        agePolicy: "UNKNOWN",
        ageMinMonths,
        ageMaxMonths: ageMinMonths + 72,
        priceMode: isFree ? "FREE" : "FROM",
        priceFrom: isFree ? 0 : 25 + index * 10,
        currency: "BYN",
        status: "PUBLISHED",
        publishedAt,
        archivedAt: null,
        bookingEnabled: false,
        campProgramType: chip === "camps" ? "CITY" : null,
        seoRobots: "noindex,nofollow",
      };
    }),
  );
}

async function main() {
  if (!process.argv.includes("--apply")) {
    throw new Error("No changes made. Use --apply with explicit DEV safety variables.");
  }
  await assertDevTarget();

  const city = await prisma.city.findFirst({
    where: { slug: "minsk", country: { isoCode: "BY" }, isLegacyNonCity: false },
    select: { id: true },
  });
  const territory = await prisma.territory.findFirst({
    where: { type: "CITY", slug: "minsk", isActive: true, isLegacyNonCity: false },
    select: { id: true },
  });
  if (!city || !territory) throw new Error("Minsk city/territory not found; run system seed first.");

  const activeChips = await prisma.discoveryClassChip.findMany({
    where: { surfaceKey: "CLASSES", isActive: true, slug: { in: Object.keys(categories) } },
    select: { slug: true },
  });
  if (activeChips.length !== Object.keys(categories).length) {
    throw new Error("Expected all nine class chips to be active. Run system seed/migrations first.");
  }

  const owner = await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: {},
    create: { email: USER_EMAIL, role: "USER" },
  });
  const existingPlace = await prisma.place.findUnique({
    where: { cityId_slug: { cityId: city.id, slug: PLACE_SLUG } },
    select: { createdByUserId: true },
  });
  if (existingPlace && existingPlace.createdByUserId !== owner.id) {
    throw new Error("Fixture place slug belongs to another owner; refusing to modify it.");
  }

  const place = await prisma.place.upsert({
    where: { cityId_slug: { cityId: city.id, slug: PLACE_SLUG } },
    update: { status: "PUBLISHED", archivedAt: null, territoryId: territory.id },
    create: {
      createdByUserId: owner.id,
      title: "[DEV] Учебная площадка занятий",
      slug: PLACE_SLUG,
      slugUpdatedAt: new Date(),
      cityId: city.id,
      territoryId: territory.id,
      category: "education",
      shortDesc: "Тестовая площадка DEV, не реальная организация.",
      status: "PUBLISHED",
      ageTags: [],
      visitFormats: [],
      activityTypes: [],
      locationSource: "MANUAL",
      seoRobots: "noindex,nofollow",
    },
  });

  const rows = makeFixtures(city.id, territory.id, place.id);
  if (rows.length !== 45) throw new Error("Fixture contract: expected exactly 45 class Offers.");
  const existing = await prisma.offer.findMany({
    where: { cityId: city.id, slug: { in: rows.map((row) => row.slug!).filter(Boolean) } },
    select: { slug: true, placeId: true },
  });
  if (existing.some((row) => row.placeId !== place.id)) {
    throw new Error("A fixture Offer slug is occupied by a non-fixture Place; refusing to overwrite.");
  }

  const created = await prisma.offer.createMany({ data: rows, skipDuplicates: true });
  const present = await prisma.offer.findMany({
    where: { cityId: city.id, placeId: place.id, slug: { in: rows.map((row) => row.slug!).filter(Boolean) }, status: "PUBLISHED", archivedAt: null },
    select: { classChipSlugs: true },
  });
  const counts = Object.fromEntries(Object.keys(categories).map((chip) => [
    chip, present.filter((row) => row.classChipSlugs.includes(chip)).length,
  ]));
  console.log(JSON.stringify({ created: created.count, totalPublished: present.length, byCategory: counts }, null, 2));
  if (present.length !== 45 || Object.values(counts).some((count) => count !== 5)) {
    throw new Error("DEV class catalog verification failed; inspect existing fixture status.");
  }
}

main()
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
