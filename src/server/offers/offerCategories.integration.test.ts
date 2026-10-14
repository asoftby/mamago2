import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { OfferCategoriesError, listOfferCategories, syncOfferCategories } from "./offerCategories";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("offerCategories integration tests require a disposable localhost PostgreSQL DATABASE_URL");
}
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const ownerId = `cat-owner-${run}`;
let businessId = "";
let placeId = "";
const offerIds: string[] = [];
const chipSlugs: string[] = [];
const categoryIds: string[] = [];

after(async () => {
  if (offerIds.length) await db.offer.deleteMany({ where: { id: { in: offerIds } } });
  if (categoryIds.length) await db.eventCategory.deleteMany({ where: { id: { in: categoryIds } } });
  await db.eventCategory.deleteMany({ where: { publicationType: "OFFER", slug: { in: chipSlugs.map((slug) => `class-${slug}`) } } });
  if (chipSlugs.length) await db.discoveryClassChip.deleteMany({ where: { slug: { in: chipSlugs } } });
  if (placeId) await db.place.delete({ where: { id: placeId } });
  if (businessId) await db.business.delete({ where: { id: businessId } });
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.$disconnect();
});

async function fixtureOffer(productType: "PARTY_PACKAGE" | "REGULAR_ACTIVITY") {
  if (!businessId) {
    await db.user.create({ data: { id: ownerId, email: `${ownerId}@example.test` } });
    businessId = (await db.business.create({ data: { name: `cat-${run}`, ownerUserId: ownerId } })).id;
    placeId = (await db.place.create({
      data: {
        title: `Cat place ${run}`, shortDesc: "Test place", createdByUserId: ownerId, ownerBusinessId: businessId,
        activityTypes: [], ageTags: [], visitFormats: [],
      },
    })).id;
  }
  const offer = await db.offer.create({
    data: { kind: "SERVICE", productType, title: `Offer ${run}`, placeId, status: "DRAFT" },
  });
  offerIds.push(offer.id);
  return offer;
}

test("class categories are created from class chips on first read (fresh database)", async () => {
  const slug = `chip-${run}`;
  chipSlugs.push(slug);
  await db.discoveryClassChip.create({ data: { title: `Чип ${run}`, slug, isActive: true } });
  await db.eventCategory.deleteMany({ where: { publicationType: "OFFER", slug: `class-${slug}` } });

  const list = await listOfferCategories(db, "REGULAR_ACTIVITY");
  assert.ok(list.some((category) => category.slug === `class-${slug}`), "class category appears without a migration copy");

  // повторное чтение идемпотентно — дублей нет
  await listOfferCategories(db, "REGULAR_ACTIVITY");
  assert.equal(await db.eventCategory.count({ where: { publicationType: "OFFER", slug: `class-${slug}` } }), 1);
});

test("an already assigned category stays valid after it is deactivated; new inactive ones are rejected", async () => {
  const offer = await fixtureOffer("PARTY_PACKAGE");
  const a = await db.eventCategory.create({
    data: { nameRu: `A ${run}`, nameEn: `A ${run}`, slug: `party-a-${run}`, publicationType: "OFFER", isActive: true },
  });
  const b = await db.eventCategory.create({
    data: { nameRu: `B ${run}`, nameEn: `B ${run}`, slug: `party-b-${run}`, publicationType: "OFFER", isActive: true },
  });
  categoryIds.push(a.id, b.id);

  await db.$transaction((tx) => syncOfferCategories({ db: tx, offerId: offer.id, productType: "PARTY_PACKAGE", categoryIds: [a.id] }));

  // админ деактивировал назначенную категорию; мастер всё равно шлёт её id при любой правке
  await db.eventCategory.update({ where: { id: a.id }, data: { isActive: false } });
  const kept = await db.$transaction((tx) =>
    syncOfferCategories({ db: tx, offerId: offer.id, productType: "PARTY_PACKAGE", categoryIds: [a.id] }),
  );
  assert.deepEqual(kept, [a.id]);

  // новая деактивированная категория не назначается
  await db.eventCategory.update({ where: { id: b.id }, data: { isActive: false } });
  await assert.rejects(
    db.$transaction((tx) => syncOfferCategories({ db: tx, offerId: offer.id, productType: "PARTY_PACKAGE", categoryIds: [a.id, b.id] })),
    (error: unknown) => error instanceof OfferCategoriesError && error.code === "INVALID",
  );
});
