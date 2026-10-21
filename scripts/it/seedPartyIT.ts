// SAFE isolated local IT seed. Accounts have no passwords. Never run outside port 55443.
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
const parsed = new URL(url);
if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55443" || parsed.pathname !== "/mamago_birthday_it") throw new Error("Refusing to seed: not the isolated test DB");
const prisma = new PrismaClient();

async function user(email: string, role: "USER" | "BUSINESS_OWNER") {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role, emailVerifiedAt: new Date() },
  });
}

async function main() {
  const country = await prisma.country.findFirst({ where: { isoCode: "BY" } })
    ?? await prisma.country.create({ data: { name: "Беларусь", slug: "by", isoCode: "BY", isActive: true } });
  const city = await prisma.city.findFirst({ where: { slug: "minsk" } })
    ?? await prisma.city.create({ data: { countryId: country.id, name: "Минск", slug: "minsk", isActive: true } });

  await user("parent@it.test", "USER");
  const ownerA = await user("owner-a@it.test", "BUSINESS_OWNER");
  const ownerB = await user("owner-b@it.test", "BUSINESS_OWNER");
  const mkBusiness = async (owner: { id: string }, name: string) => {
    const b = await prisma.business.upsert({
      where: { ownerUserId: owner.id }, update: {},
      create: { name, ownerUserId: owner.id, status: "APPROVED", operationalStatus: "ACTIVE" },
    });
    await prisma.businessMember.upsert({
      where: { businessId_userId: { businessId: b.id, userId: owner.id } }, update: {},
      create: { businessId: b.id, userId: owner.id, role: "OWNER" },
    });
    return b;
  };
  const bizA = await mkBusiness(ownerA, "Студия Праздника A");
  const bizB = await mkBusiness(ownerB, "Аниматоры B");
  const mkPlace = (biz: { id: string }, title: string, slug: string, by: { id: string }) =>
    prisma.place.upsert({
      where: { cityId_slug: { cityId: city.id, slug } }, update: {},
      create: { title, slug, shortDesc: title, cityId: city.id, status: "PUBLISHED", ownerBusinessId: biz.id, createdByUserId: by.id },
    });
  const placeA = await mkPlace(bizA, "Игровая студия A", "studio-a", ownerA);
  const placeB = await mkPlace(bizB, "Мастерская B", "workshop-b", ownerB);

  type O = { key: string; place: { id: string }; title: string; productType: "PARTY_SERVICE" | "PARTY_PACKAGE";
    category?: "VENUE" | "ANIMATOR" | "CAKE" | "SHOW" | "PHOTO"; priceFrom: number | null;
    priceMode: "FROM" | "EXACT" | "FREE" | "ON_REQUEST"; ageMin?: number; ageMax?: number; minC?: number; maxC?: number;
    details?: object; cover?: string };
  const offers: O[] = [
    { key: "pkg", place: placeA, title: "Праздник под ключ", productType: "PARTY_PACKAGE", priceFrom: 650, priceMode: "FROM",
      details: { includedCategories: ["VENUE", "ANIMATOR"], prepaymentTerms: "30% после подтверждения", cancellationTerms: "Бесплатно за 7 дней" }, minC: 5, maxC: 15 },
    { key: "venue", place: placeA, title: "Игровая комната", productType: "PARTY_SERVICE", category: "VENUE", priceFrom: 350, priceMode: "FROM", minC: 3, maxC: 12 },
    { key: "anim", place: placeB, title: "Аниматор Вася", productType: "PARTY_SERVICE", category: "ANIMATOR", priceFrom: 180, priceMode: "FROM", ageMin: 36, ageMax: 120 },
    { key: "cake", place: placeB, title: "Торт на заказ", productType: "PARTY_SERVICE", category: "CAKE", priceFrom: 999, priceMode: "ON_REQUEST" },
    { key: "show", place: placeB, title: "Шоу мыльных пузырей", productType: "PARTY_SERVICE", category: "SHOW", priceFrom: null, priceMode: "FREE" },
    { key: "photo", place: placeB, title: "Фотограф", productType: "PARTY_SERVICE", category: "PHOTO", priceFrom: 120, priceMode: "EXACT" },
  ];
  for (const o of offers) {
    const id = "it-offer-" + o.key;
    await prisma.offer.upsert({
      where: { id }, update: { priceFrom: o.priceFrom, priceMode: o.priceMode },
      create: {
        id, placeId: o.place.id, kind: "SERVICE", productType: o.productType, category: o.category, title: o.title,
        status: "PUBLISHED", publishedAt: new Date(), priceFrom: o.priceFrom, priceMode: o.priceMode, currency: "BYN",
        ageMinMonths: o.ageMin, ageMaxMonths: o.ageMax, minChildren: o.minC, maxChildren: o.maxC, details: o.details,
        partyLocationType: o.productType === "PARTY_PACKAGE" ? "ON_SITE" : undefined,
      },
    });
    await prisma.offerPlacement.upsert({
      where: { offerId_key: { offerId: id, key: "BIRTHDAY" } }, update: { status: "APPROVED" },
      create: { offerId: id, key: "BIRTHDAY", status: "APPROVED" },
    });
  }
  console.log("seeded", { users: 3, businesses: 2, offers: offers.length });
}
main().finally(() => prisma.$disconnect());
