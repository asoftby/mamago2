import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { addOfferPlanItem, removePlanItem } from "./plan.service";
import { activePlanScopeFor } from "@/server/family/familyAccess";

// Mutating integration test: only the isolated GitHub Actions PostgreSQL.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55444" ||
    url.pathname !== "/mamago_plan_recurrence_it" ||
    process.env.FAMILY_CORE_READS !== "true") {
  throw new Error("SAFE ABORT: isolated Plan DB with family reads required");
}

async function main() {
  const owner = await prisma.user.create({ data: { email: "offer-plan-owner@it.test" } });
  const member = await prisma.user.create({ data: { email: "offer-plan-member@it.test" } });
  const outsider = await prisma.user.create({ data: { email: "offer-plan-outsider@it.test" } });
  const family = await prisma.family.create({ data: { name: "Offer test family" } });
  const unrelated = await prisma.family.create({ data: { name: "Other offer test family" } });
  await prisma.familyMembership.createMany({
    data: [
      { userId: owner.id, familyId: family.id, role: "OWNER" },
      { userId: member.id, familyId: family.id, role: "ADULT" },
      { userId: outsider.id, familyId: unrelated.id, role: "OWNER" },
    ],
  });

  const sharedOffer = await prisma.offer.create({
    data: { title: "Семейный мастер-класс", kind: "SERVICE", status: "PUBLISHED", coverImage: "https://example.com/photo.jpg" },
  });
  const privateOffer = await prisma.offer.create({
    data: { title: "Персональное занятие", kind: "SERVICE", status: "PUBLISHED" },
  });
  const duplicateOffer = await prisma.offer.create({
    data: { title: "Параллельное сохранение", kind: "SERVICE", status: "PUBLISHED" },
  });
  const draftOffer = await prisma.offer.create({
    data: { title: "Черновик", kind: "SERVICE", status: "DRAFT" },
  });

  const first = await addOfferPlanItem(owner.id, sharedOffer.id, "2026-11-02");
  const updated = await addOfferPlanItem(owner.id, sharedOffer.id, "2026-11-04");
  assert.equal(updated.id, first.id, "Resave updates the same plan item");
  const sharedRows = await prisma.planItem.findMany({ where: { offerId: sharedOffer.id } });
  assert.equal(sharedRows.length, 1);
  assert.equal(sharedRows[0]?.date, "2026-11-04");
  assert.equal(sharedRows[0]?.title, sharedOffer.title);
  assert.equal(sharedRows[0]?.coverImageUrl, sharedOffer.coverImage);
  assert.equal(sharedRows[0]?.source, "CATALOG");
  assert.equal(sharedRows[0]?.familyId, family.id);

  const memberVisible = await prisma.planItem.findMany({
    where: { ...(await activePlanScopeFor(member.id)), offerId: sharedOffer.id },
  });
  assert.equal(memberVisible.length, 1, "Member sees FAMILY offer");
  assert.equal(await prisma.planItem.count({
    where: { ...(await activePlanScopeFor(outsider.id)), offerId: sharedOffer.id },
  }), 0, "Other family cannot see saved offer");

  const ownerPrivate = await addOfferPlanItem(owner.id, privateOffer.id, "2026-11-04", { visibility: "PRIVATE" });
  assert.equal(await prisma.planItem.count({
    where: { ...(await activePlanScopeFor(member.id)), offerId: privateOffer.id },
  }), 0, "Other family member cannot see private save");
  const memberPrivate = await addOfferPlanItem(member.id, privateOffer.id, "2026-11-05", { visibility: "PRIVATE" });
  assert.notEqual(ownerPrivate.id, memberPrivate.id);
  assert.equal(await prisma.planItem.count({ where: { offerId: privateOffer.id } }), 2);

  const attempts = await Promise.all([
    addOfferPlanItem(owner.id, duplicateOffer.id, "2026-11-05"),
    addOfferPlanItem(owner.id, duplicateOffer.id, "2026-11-05"),
  ]);
  assert.equal(attempts[0]?.id, attempts[1]?.id, "Concurrent saves must return the same ID");
  assert.equal(await prisma.planItem.count({ where: { offerId: duplicateOffer.id } }), 1);

  await removePlanItem(outsider.id, first.id);
  assert.equal(await prisma.planItem.count({ where: { id: first.id } }), 1,
    "Unrelated family cannot delete another family's record");
  await removePlanItem(owner.id, first.id);
  assert.equal(await prisma.planItem.count({ where: { id: first.id } }), 0);

  await assert.rejects(() => addOfferPlanItem(owner.id, draftOffer.id, "2026-11-05"), /Offer not found/);
  console.log("PASS server-backed Offer persistence, idempotency, family ACL and removal");
}
main().finally(() => prisma.$disconnect());
