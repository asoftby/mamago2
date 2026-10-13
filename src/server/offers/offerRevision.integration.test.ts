import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  OfferRevisionError,
  approveOfferRevision,
  rejectOfferRevision,
  savePendingOfferRevision,
} from "./offerRevision.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("offerRevision integration tests require a disposable localhost PostgreSQL DATABASE_URL");
}
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const ownerId = `rev-owner-${run}`;
const adminId = `rev-admin-${run}`;
let businessId = "";
let placeId = "";
const offerIds: string[] = [];
const extraPlaceIds: string[] = [];
const categoryIds: string[] = [];

after(async () => {
  if (offerIds.length) await db.offer.deleteMany({ where: { id: { in: offerIds } } });
  if (categoryIds.length) await db.eventCategory.deleteMany({ where: { id: { in: categoryIds } } });
  if (extraPlaceIds.length) await db.place.deleteMany({ where: { id: { in: extraPlaceIds } } });
  await db.notification.deleteMany({ where: { userId: { in: [ownerId, adminId] } } });
  await db.adminAuditLog.deleteMany({ where: { actorId: adminId } });
  if (placeId) await db.place.delete({ where: { id: placeId } });
  if (businessId) await db.business.delete({ where: { id: businessId } });
  await db.user.deleteMany({ where: { id: { in: [ownerId, adminId] } } });
  await db.$disconnect();
});

async function fixture() {
  if (businessId) return;
  await db.user.create({ data: { id: ownerId, email: `${ownerId}@example.test` } });
  await db.user.create({ data: { id: adminId, email: `${adminId}@example.test`, role: "ADMIN" } });
  businessId = (await db.business.create({ data: { name: `rev-${run}`, ownerUserId: ownerId } })).id;
  placeId = (await db.place.create({
    data: {
      title: `Rev place ${run}`,
      shortDesc: "Test place",
      createdByUserId: ownerId,
      ownerBusinessId: businessId,
      activityTypes: [],
      ageTags: [],
      visitFormats: [],
    },
  })).id;
}

async function publishedOffer() {
  await fixture();
  const offer = await db.offer.create({
    data: {
      kind: "SERVICE",
      productType: "ONE_TIME_ACTIVITY",
      title: `Live title ${run}`,
      description: "Live description",
      placeId,
      status: "PUBLISHED",
      galleryImages: ["live-1.jpg"],
      campSessions: [
        { id: "s1", title: "Июнь", description: "Старое", dateFrom: "2026-06-03", dateTo: "2026-06-10", priceOverride: "550" },
      ],
    },
  });
  offerIds.push(offer.id);
  return offer;
}

async function save(offerId: string, proposal: Record<string, unknown>, presentColumns: string[]) {
  const live = await db.offer.findUniqueOrThrow({ where: { id: offerId } });
  return db.$transaction((tx) =>
    savePendingOfferRevision(tx, {
      offerId,
      authorId: ownerId,
      proposal,
      presentColumns,
      live: live as unknown as Record<string, unknown> & { updatedAt?: Date },
    }),
  );
}

test("saving a proposal creates one pending revision and re-evaluates present columns", async () => {
  const offer = await publishedOffer();

  const first = await save(offer.id, { title: "Новое название", description: "Новое описание" }, ["title", "description", "galleryImages"]);
  assert.equal(first.created, true);
  assert.deepEqual(first.changedFields.sort(), ["description", "title"]);

  // следующий запрос: название изменено ещё раз, описание возвращено к живому → из ревизии уходит
  const second = await save(offer.id, { title: "Ещё новее" }, ["title", "description", "galleryImages"]);
  assert.equal(second.created, false);
  assert.deepEqual(second.changedFields, ["title"]);

  const pending = await db.offerRevision.findMany({ where: { offerId: offer.id, status: "PENDING" } });
  assert.equal(pending.length, 1);
  assert.deepEqual(pending[0].payload, { title: "Ещё новее" });

  // автор вернул всё как было → ожидающая ревизия снимается
  const third = await save(offer.id, {}, ["title"]);
  assert.equal(third.revisionId, null);
  assert.equal(await db.offerRevision.count({ where: { offerId: offer.id, status: "PENDING" } }), 0);

  // живая строка всё это время не менялась
  const live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(live.title, `Live title ${run}`);
});

test("database allows only one PENDING revision per offer", async () => {
  const offer = await publishedOffer();
  await db.offerRevision.create({ data: { offerId: offer.id, authorId: ownerId, payload: { title: "A" }, changedFields: ["title"] } });
  await assert.rejects(
    db.offerRevision.create({ data: { offerId: offer.id, authorId: ownerId, payload: { title: "B" }, changedFields: ["title"] } }),
  );
});

test("approve applies content, camp texts keep live dates and price, and notifies the author", async () => {
  const offer = await publishedOffer();
  await save(
    offer.id,
    {
      title: "Одобренное название",
      galleryImages: ["new-1.jpg", "new-2.jpg"],
      details: null,
      campSessionTexts: [
        { id: "s1", title: "Июнь (новое)", description: "Новое", dateFrom: "2026-01-01", priceOverride: "1" },
      ],
    },
    ["title", "galleryImages", "details", "campSessionTexts"],
  );
  const revision = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id, status: "PENDING" } });

  await approveOfferRevision(revision.id, adminId, "ADMIN");

  const live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(live.title, "Одобренное название");
  assert.deepEqual(live.galleryImages, ["new-1.jpg", "new-2.jpg"]);
  const sessions = live.campSessions as Array<Record<string, unknown>>;
  assert.equal(sessions[0].title, "Июнь (новое)");
  assert.equal(sessions[0].description, "Новое");
  assert.equal(sessions[0].dateFrom, "2026-06-03", "dates stay live");
  assert.equal(sessions[0].priceOverride, "550", "price stays live");

  const closed = await db.offerRevision.findUniqueOrThrow({ where: { id: revision.id } });
  assert.equal(closed.status, "APPROVED");
  assert.equal(closed.reviewedById, adminId);
  assert.ok(await db.notification.findFirst({ where: { userId: ownerId, entityId: offer.id, title: "Правки опубликованы" } }));
  assert.ok(await db.adminAuditLog.findFirst({ where: { entityId: offer.id, action: "offer.revision_approved" } }));

  // повторное решение по закрытой ревизии невозможно
  await assert.rejects(approveOfferRevision(revision.id, adminId, "ADMIN"), (error: unknown) =>
    error instanceof OfferRevisionError && error.code === "NOT_PENDING",
  );
});

test("reject keeps the live offer and stores the moderator comment", async () => {
  const offer = await publishedOffer();
  await save(offer.id, { title: "Отклонённое" }, ["title"]);
  const revision = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id, status: "PENDING" } });

  await rejectOfferRevision(revision.id, adminId, "ADMIN", "Нужны другие фото");

  const live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(live.title, `Live title ${run}`);
  const closed = await db.offerRevision.findUniqueOrThrow({ where: { id: revision.id } });
  assert.equal(closed.status, "REJECTED");
  assert.equal(closed.moderatorComment, "Нужны другие фото");
  assert.ok(await db.notification.findFirst({ where: { userId: ownerId, entityId: offer.id, title: "Правки не приняты" } }));
});

test("approve applies categories, interests and a place change from the revision", async () => {
  const offer = await db.offer.create({
    data: { kind: "SERVICE", productType: "PARTY_PACKAGE", title: `Party ${run}`, placeId: (await publishedOffer()).placeId, status: "PUBLISHED" },
  });
  offerIds.push(offer.id);
  const category = await db.eventCategory.create({
    data: { nameRu: `Кат ${run}`, nameEn: `Cat ${run}`, slug: `party-rev-${run}`, publicationType: "OFFER", isActive: true },
  });
  categoryIds.push(category.id);
  const otherPlace = await db.place.create({
    data: {
      title: `Other place ${run}`, shortDesc: "Other", createdByUserId: ownerId, ownerBusinessId: businessId,
      activityTypes: [], ageTags: [], visitFormats: [],
    },
  });
  extraPlaceIds.push(otherPlace.id);

  await save(offer.id, { categoryIds: [category.id], interestSlugs: ["sport", "music"], placeId: otherPlace.id }, ["categoryIds", "interestSlugs", "placeId"]);
  const revision = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id, status: "PENDING" } });
  assert.deepEqual(revision.changedFields.sort(), ["categoryIds", "interestSlugs", "placeId"]);

  // до решения живая строка не менялась
  const before = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.deepEqual(before.interestSlugs, []);
  assert.equal(await db.offerCategory.count({ where: { offerId: offer.id } }), 0);

  await approveOfferRevision(revision.id, adminId, "MODERATOR");

  const live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.deepEqual(live.interestSlugs, ["sport", "music"]);
  assert.equal(live.placeId, otherPlace.id);
  const links = await db.offerCategory.findMany({ where: { offerId: offer.id } });
  assert.deepEqual(links.map((link) => link.categoryId), [category.id]);

  // аудит фиксирует реальную роль модератора
  const audit = await db.adminAuditLog.findFirstOrThrow({ where: { entityId: offer.id, action: "offer.revision_approved" } });
  assert.equal(audit.actorRole, "MODERATOR");
});

test("approving a type switch to camp keeps the proposed sessions, switching back clears them", async () => {
  const offer = await publishedOffer();
  await db.offer.update({ where: { id: offer.id }, data: { campSessions: [] } });

  const proposedSessions = [
    { id: "n1", title: "Новая смена", description: "Текст", dateFrom: "2026-08-03", dateTo: "2026-08-10", priceOverride: "700" },
  ];
  await save(
    offer.id,
    { productType: "CAMP", campProgramType: "городской", campSessions: proposedSessions },
    ["productType", "campProgramType", "campSessions"],
  );
  const toCamp = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id, status: "PENDING" } });
  await approveOfferRevision(toCamp.id, adminId, "ADMIN");

  let live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(live.productType, "CAMP");
  assert.deepEqual(live.campSessions, proposedSessions, "proposed sessions are saved, not an empty list");
  assert.equal(await db.offerSession.count({ where: { offerId: offer.id } }), 1, "OfferSession projected from the approved sessions");

  // обратно на обычный тип: смены и проекция очищаются
  await save(offer.id, { productType: "ONE_TIME_ACTIVITY", campProgramType: null, campSessions: null }, ["productType", "campProgramType", "campSessions"]);
  const back = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id, status: "PENDING" } });
  await approveOfferRevision(back.id, adminId, "ADMIN");

  live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(live.productType, "ONE_TIME_ACTIVITY");
  assert.equal(live.campProgramType, null);
  assert.equal(live.campSessions, null);
  assert.equal(await db.offerSession.count({ where: { offerId: offer.id } }), 0, "OfferSession cleared with the camp type");
});
