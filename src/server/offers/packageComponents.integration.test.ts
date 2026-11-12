import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { packageComponentInputSchema, componentRows, savePackageComponents, validatePackageCredits } from "./packageComponents";
import { approveOfferRevision, savePendingOfferRevision } from "./offerRevision.service";
import { loadOfferForWizard } from "@/lib/content-editor/loadOfferForWizard";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55443" || url.pathname !== "/mamago_birthday_it") throw Error("Not the isolated IT database");
async function main() {
  const seed = await prisma.offer.findUniqueOrThrow({ where: { id: "it-offer-pkg" } });
  const offer = await prisma.offer.create({ data: { placeId: seed.placeId, kind: seed.kind, productType: "PARTY_PACKAGE",
    title: "IT package policy", status: "DRAFT", priceFrom: 500, priceMode: "EXACT" } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner-a@it.test" } });
  const moderator = await prisma.user.upsert({ where: { email: "package-moderator@it.test" }, create: { email: "package-moderator@it.test", role: "MODERATOR" }, update: {} });
  await prisma.offer.update({ where: { id: offer.id }, data: { status: "DRAFT", priceMode: "EXACT", priceFrom: 500 } });
  const rows = packageComponentInputSchema.parse([
    { title: "Зал", category: "VENUE", removalPolicy: "REQUIRED", removalCreditByn: null },
    { title: "Торт", category: "CAKE", removalPolicy: "REMOVABLE_NO_REFUND", removalCreditByn: null },
    { title: "Декор", category: "DECOR", removalPolicy: "REMOVABLE_FIXED_CREDIT", removalCreditByn: "50.00" },
    { title: "Шоу", category: "SHOW", removalPolicy: "REMOVABLE_QUOTE_REQUIRED", removalCreditByn: null },
  ]);
  await prisma.$transaction(tx => savePackageComponents(tx, offer.id, rows, []));
  const saved = componentRows(await prisma.packageComponent.findMany({ where: { packageId: offer.id, archivedAt: null }, orderBy: [{ position: "asc" }, { id: "asc" }] }));
  assert.equal(saved.length, 4);
  await prisma.$transaction(tx => savePackageComponents(tx, offer.id, saved, saved));
  await assert.rejects(prisma.$transaction(tx => savePackageComponents(tx, offer.id, saved, [])), /Состав изменился/);
  for (const mode of ["FROM", "ON_REQUEST"]) assert.throws(() => validatePackageCredits(saved, mode, 500));
  assert.throws(() => validatePackageCredits(saved, "EXACT", 49));
  assert.throws(() => packageComponentInputSchema.parse([{ ...rows[2], removalCreditByn: "-1" }]));
  assert.throws(() => packageComponentInputSchema.parse([{ ...rows[0], removalCreditByn: "1" }]));
  await prisma.offer.update({ where: { id: offer.id }, data: { status: "PUBLISHED" } });
  const changed = saved.map(row => row.category === "DECOR" ? { ...row, removalCreditByn: "75.00" } : row);
  await assert.rejects(prisma.$transaction(tx => savePackageComponents(tx, offer.id, changed, saved)), /модерацию/);
  const revision = await prisma.$transaction(tx => savePendingOfferRevision(tx, {
    offerId: offer.id, authorId: owner.id,
    proposal: { packageComponents: { rows: changed, baseline: saved } }, presentColumns: ["packageComponents"], live: offer,
  }));
  const restored = await loadOfferForWizard(offer.id);
  assert.equal((restored.offerForWizard?.components?.find(row => row.category === "DECOR")?.removalCreditByn)?.toString(), "75.00");
  const stillLive = await prisma.packageComponent.findFirstOrThrow({ where: { packageId: offer.id, category: "DECOR" } });
  assert.equal(stillLive.removalCreditByn?.toFixed(2), "50.00");
  assert.ok(revision.revisionId);
  await approveOfferRevision(revision.revisionId, moderator.id, "MODERATOR");
  assert.equal((await prisma.packageComponent.findUniqueOrThrow({ where: { id: stillLive.id } })).removalCreditByn?.toFixed(2), "75.00");
  console.log("PASS policies, credit bounds, replay, CAS, author restore and published moderation");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
