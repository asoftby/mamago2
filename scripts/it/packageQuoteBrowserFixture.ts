// Local-only, disposable fixture for the authenticated Chrome acceptance journey.
import prisma from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/auth/crypto";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55443" || url.pathname !== "/mamago_birthday_it") throw Error("Not the isolated IT database");
async function main() {
  const passwordHash = await hashPassword("LocalPackageRules!2026");
  await prisma.user.updateMany({ where: { email: { in: ["parent@it.test", "owner-a@it.test", "owner-b@it.test"] } }, data: { passwordHash } });
  await prisma.business.updateMany({ where: { owner: { email: { in: ["owner-a@it.test", "owner-b@it.test"] } } }, data: { verificationStatus: "APPROVED" } });
  const parent = await prisma.user.findUniqueOrThrow({ where: { email: "parent@it.test" } });
  const seed = await prisma.offer.findUniqueOrThrow({ where: { id: "it-offer-pkg" }, include: { place: true } });
  const date = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
  const offer = await prisma.offer.create({ data: { placeId: seed.placeId, kind: seed.kind, productType: "PARTY_PACKAGE", category: "VENUE",
    title: "Пакет для Chrome " + Date.now(), priceFrom: 500, priceMode: "EXACT", status: "PUBLISHED", publishedAt: new Date(), partyLocationType: "ON_SITE",
    placements: { create: { key: "BIRTHDAY", status: "APPROVED" } }, components: { create: [
      { title: "Зал", category: "VENUE", removalPolicy: "REQUIRED", position: 0 },
      { title: "Питание", category: "FOOD", removalPolicy: "REMOVABLE_NO_REFUND", position: 1 },
      { title: "Аниматор пакета", category: "ANIMATOR", removalPolicy: "REMOVABLE_FIXED_CREDIT", removalCreditByn: 50, position: 2 },
      { title: "Шоу пакета", category: "SHOW", removalPolicy: "REMOVABLE_QUOTE_REQUIRED", position: 3 },
    ] },
  } });
  const unit = await prisma.bookingUnit.create({ data: { businessId: seed.place!.ownerBusinessId!, name: "Зал Chrome " + Date.now(), capacity: 30,
    timezone: "Europe/Minsk", rules: { create: { weekday: new Date(date + "T00:00:00Z").getUTCDay() || 7, startMinutes: 540, endMinutes: 1320 } },
    offers: { create: { offerId: offer.id } },
  } });
  console.log(JSON.stringify({ parentId: parent.id, offerId: offer.id, unitId: unit.id, date, placeId: seed.placeId }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
