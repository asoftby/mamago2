import assert from "node:assert/strict";
import prisma, { prismaBase } from "@/lib/prisma";
import { readPackageChangeScope } from "@/lib/birthday/packageChangeScope";
import { createPartyDraft, readPartyOrder, updatePartyDraft } from "./partyDraft.service";
import { submitPartyAnchor } from "./partySubmit.service";
import { replyToPartyRequest } from "./partyBusiness.service";
import { acceptPartyQuote, rejectPartyQuote } from "./partyQuoteAcceptance.service";
import { confirmPartyRequest } from "./partyConfirm.service";
import { getBusinessInbox } from "@/server/services/booking/businessInbox.service";
import { PartyApiError } from "./partyDraft.validation";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55443" || url.pathname !== "/mamago_birthday_it") throw Error("Not isolated IT database");
let queryCount = 0;
if (process.env.PRISMA_QUERY_EVENTS === "1") prismaBase.$on("query" as never, (() => { queryCount++; }) as never);
const key = Math.random().toString(36).slice(2);
const date = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
async function failure(status: number, run: () => Promise<unknown>) {
  await assert.rejects(run, error => error instanceof PartyApiError && error.status === status);
}
async function main() {
  const parent = await prisma.user.findUniqueOrThrow({ where: { email: "parent@it.test" } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner-a@it.test" } });
  const foreign = await prisma.user.findUniqueOrThrow({ where: { email: "owner-b@it.test" } });
  const business = await prisma.business.findFirstOrThrow({ where: { ownerUserId: owner.id } });
  const otherBusiness = await prisma.business.findFirstOrThrow({ where: { ownerUserId: foreign.id } });
  const seed = await prisma.offer.findUniqueOrThrow({ where: { id: "it-offer-pkg" } });
  const offer = await prisma.offer.create({ data: {
    placeId: seed.placeId, kind: seed.kind, productType: "PARTY_PACKAGE", category: "VENUE",
    title: "IT quote package " + key, status: "PUBLISHED", publishedAt: new Date(), priceFrom: 500, priceMode: "EXACT",
    placements: { create: { key: "BIRTHDAY", status: "APPROVED" } },
    components: { create: [
      { title: "Required hall", category: "VENUE", removalPolicy: "REQUIRED", position: 0 },
      { title: "No refund food", category: "FOOD", removalPolicy: "REMOVABLE_NO_REFUND", position: 1 },
      { title: "Fixed animator", category: "ANIMATOR", removalPolicy: "REMOVABLE_FIXED_CREDIT", removalCreditByn: 50, position: 2 },
      { title: "Quote show", category: "SHOW", removalPolicy: "REMOVABLE_QUOTE_REQUIRED", position: 3 },
    ] },
  } });
  const unit = await prisma.bookingUnit.create({ data: { businessId: business.id, name: "Package unit " + key,
    timezone: "Europe/Minsk", capacity: 20, rules: { create: { weekday: new Date(date + "T00:00:00Z").getUTCDay() || 7, startMinutes: 540, endMinutes: 1200 } },
    offers: { create: { offerId: offer.id } },
  } });
  const otherPlace = await prisma.place.findFirstOrThrow({ where: { ownerBusinessId: otherBusiness.id } });
  const food = await prisma.offer.create({ data: { placeId: otherPlace.id, kind: seed.kind, productType: "PARTY_SERVICE", category: "FOOD",
    title: "IT food replacement", status: "PUBLISHED", publishedAt: new Date(), priceFrom: 70, priceMode: "FROM",
    placements: { create: { key: "BIRTHDAY", status: "APPROVED" } } } });
  let serial = 0;
  async function draft(mode: "EXACT" | "FROM" | "ON_REQUEST" = "EXACT") {
    await prisma.offer.update({ where: { id: offer.id }, data: { priceMode: mode, priceFrom: mode === "ON_REQUEST" ? null : 500 } });
    const created = await createPartyDraft(parent.id, { citySlug: "minsk", venueMode: "PACKAGE" });
    const chosen = await updatePartyDraft(parent.id, created.id, { version: created.version, anchorOfferId: offer.id, addonOfferIds: ["it-offer-photo"] });
    return updatePartyDraft(parent.id, created.id, { version: chosen.version, eventDate: date, timeFrom: "12:00", timeTo: "14:00",
      childrenCount: 8, adultsCount: 4, contactName: "Local parent", contactPhone: "+375291112233" });
  }
  type Draft = Awaited<ReturnType<typeof draft>>;
  function edit(d: Draft, category: string, replacementOfferId?: string) {
    const item = d.items.find(row => row.role === "INCLUDED" && row.category === category)!;
    return updatePartyDraft(parent.id, d.id, { version: d.version, packageChange: { itemId: item.id, replacementOfferId } });
  }
  const send = (d: Draft, id = "submit" + (++serial)) => submitPartyAnchor(parent.id, d.id, d.version, key + id);
  async function reply(requestId: string, priceByn: number, expectedStage: "SENT" | "AWAITING_RECONFIRM" = "SENT", version = 0) {
    return replyToPartyRequest({ businessId: business.id, actorUserId: owner.id, requestId, idempotencyKey: key + "reply" + (++serial),
      input: { type: "MODIFIED", expectedStage, expectedQuoteVersion: version, priceByn, durationMinutes: 120, includes: "Состав по запросу без удалённых услуг", changeReason: "Уточнена стоимость изменённого пакета" } });
  }
  const raceDraft = await draft();
  const race = await Promise.allSettled(["A", "B"].map(contactName => updatePartyDraft(parent.id, raceDraft.id, { version: raceDraft.version, contactName })));
  assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
  assert.ok(race.some(result => result.status === "rejected" && result.reason instanceof PartyApiError && result.reason.status === 409));
  const plain = await draft(); const plainSent = await send(plain);
  assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: plainSent.request.id } })).bookingPriceSnapshot, null);
  const required = await draft(); await failure(422, () => edit(required, "VENUE"));
  const noRefund = await edit(await draft(), "FOOD");
  process.env.PARTY_CONFIRMATION_ENABLED = "false";
  await failure(422, () => send(noRefund));
  assert.equal((await readPartyOrder(parent.id, noRefund.id)).status, "DRAFT");
  process.env.PARTY_CONFIRMATION_ENABLED = "true";
  const noRefundSent = await send(noRefund);
  const noRefundScope = readPackageChangeScope((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: noRefundSent.request.id } })).bookingPriceSnapshot)!;
  assert.equal(noRefundScope.requestedPrice.amountByn, "500.00");
  const agreed = await replyToPartyRequest({ businessId: business.id, actorUserId: owner.id, requestId: noRefundSent.request.id, idempotencyKey: key + "asrequested",
    input: { type: "AS_REQUESTED", expectedStage: "SENT", expectedQuoteVersion: 0, priceByn: 500, includes: "Без питания, цена без изменения" } });
  assert.equal(agreed.quote.status, "ACTIVE");
  assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: noRefundSent.request.id } })).partyStage, "QUOTED");
  const foodDraft = await edit(await draft(), "FOOD", food.id);
  const foodSent = await send(foodDraft);
  const foodScope = readPackageChangeScope((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: foodSent.request.id } })).bookingPriceSnapshot)!;
  assert.equal(foodScope.requestedPrice.amountByn, "500.00");
  assert.equal(foodScope.standalone.find(row => row.offerId === food.id)?.price.amountByn, "70.00");
  const showDraft = await edit(await draft(), "SHOW", "it-offer-show"); const showSent = await send(showDraft);
  const showScope = readPackageChangeScope((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: showSent.request.id } })).bookingPriceSnapshot)!;
  assert.equal(showScope.requestedPrice.mode, "ON_REQUEST");
  assert.equal(showScope.standalone.find(row => row.offerId === "it-offer-show")?.price.amountByn, "0.00");
  let changed = await edit(await draft(), "ANIMATOR", "it-offer-anim");
  const fixedOnly = await send(changed); const fixedScope = readPackageChangeScope((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: fixedOnly.request.id } })).bookingPriceSnapshot)!;
  assert.equal(fixedScope.requestedPrice.amountByn, "450.00");
  assert.equal(fixedScope.standalone.length, 2);
  changed = await edit(await draft(), "ANIMATOR", "it-offer-anim");
  changed = await edit(changed, "SHOW");
  const reloaded = await readPartyOrder(parent.id, changed.id); assert.deepEqual(reloaded.items.map(i => i.packageComponentChange), changed.items.map(i => i.packageComponentChange));
  await failure(409, () => submitPartyAnchor(parent.id, changed.id, changed.version - 1, key + "stale"));
  await failure(404, () => submitPartyAnchor(foreign.id, changed.id, changed.version, key + "foreign"));
  // Catalogue edits after the draft cannot rewrite the requested monetary base.
  await prisma.offer.update({ where: { id: offer.id }, data: { priceFrom: 900 } });
  const sent = await send(changed, "main");
  assert.equal((await send(changed, "main")).alreadySubmitted, true);
  const frozen = (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: sent.request.id } })).bookingPriceSnapshot;
  const scope = readPackageChangeScope(frozen)!;
  assert.equal(scope.originalPrice.amountByn, "500.00"); assert.equal(scope.requestedPrice.mode, "ON_REQUEST");
  assert.equal(scope.draftVersion, changed.version); assert.equal(scope.components.find(i => i.snapshot.category === "ANIMATOR")?.creditByn, "50.00");
  await failure(409, () => updatePartyDraft(parent.id, changed.id, { version: changed.version, contactName: "Late" }));
  await failure(404, () => replyToPartyRequest({ businessId: otherBusiness.id, actorUserId: foreign.id, requestId: sent.request.id, idempotencyKey: key + "wrong",
    input: { type: "MODIFIED", expectedStage: "SENT", expectedQuoteVersion: 0, priceByn: 1, includes: "Wrong", changeReason: "Foreign access" } }));
  await failure(422, () => replyToPartyRequest({ businessId: business.id, actorUserId: owner.id, requestId: sent.request.id, idempotencyKey: key + "oversized-duration",
    input: { type: "MODIFIED", expectedStage: "SENT", expectedQuoteVersion: 0, priceByn: 430, durationMinutes: 240, includes: "Changed package", changeReason: "Different service duration" } }));
  assert.equal(await prisma.partyQuote.count({ where: { bookingRequestId: sent.request.id } }), 0);
  const first = await reply(sent.request.id, 430);
  const decision = (quoteId: string, version: number, userId = parent.id) => ({ userId, orderId: changed.id, requestId: sent.request.id, quoteId, expectedVersion: version });
  await failure(404, () => acceptPartyQuote(decision(first.quote.id, 1, foreign.id)));
  await acceptPartyQuote(decision(first.quote.id, 1));
  const second = await reply(sent.request.id, 470, "AWAITING_RECONFIRM", 1);
  await failure(409, () => acceptPartyQuote(decision(first.quote.id, 1)));
  await acceptPartyQuote(decision(second.quote.id, 2));
  assert.equal((await acceptPartyQuote(decision(second.quote.id, 2))).alreadyAccepted, true);
  const confirmation = { businessId: business.id, actorUserId: owner.id, requestId: sent.request.id, expectedQuoteVersion: 2, idempotencyKey: key + "confirm", bookingUnitId: unit.id };
  await confirmPartyRequest(confirmation); assert.equal((await confirmPartyRequest(confirmation)).alreadyConfirmed, true);
  const completed = await readPartyOrder(parent.id, changed.id);
  assert.equal(completed.items.find(i => i.role === "ANCHOR")?.offerPriceSnapshot?.toFixed(2), "470.00");
  assert.ok(completed.items.filter(i => i.role === "INCLUDED" && i.packageComponentChange).every(i => i.status === "CANCELLED"));
  assert.ok(completed.items.filter(i => i.role === "STANDALONE").every(i => i.status !== "CONFIRMED"));
  assert.equal(await prisma.bookingAllocation.count({ where: { bookingRequestId: sent.request.id, status: "CONFIRMED" } }), 1);
  assert.deepEqual((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: sent.request.id } })).bookingPriceSnapshot, frozen);
  queryCount = 0;
  const focused = await getBusinessInbox({ businessId: business.id, requestId: sent.request.id, kind: "party" });
  if (process.env.PRISMA_QUERY_EVENTS === "1") console.log("MEASURE focused inbox SQL statements:", queryCount, "response bytes:", Buffer.byteLength(JSON.stringify(focused)));
  assert.equal(focused.items[0]?.id, sent.request.id); assert.ok(focused.items[0].packageScope);
  assert.equal((await getBusinessInbox({ businessId: otherBusiness.id, requestId: sent.request.id })).items.length, 0);
  // A second accepted request must still respect the occupied inventory.
  const collisionDraft = await edit(await draft(), "FOOD"); const collision = await send(collisionDraft); const cq = await reply(collision.request.id, 500);
  await acceptPartyQuote({ userId: parent.id, orderId: collisionDraft.id, requestId: collision.request.id, quoteId: cq.quote.id, expectedVersion: 1 });
  await failure(409, () => confirmPartyRequest({ ...confirmation, requestId: collision.request.id, expectedQuoteVersion: 1, idempotencyKey: key + "collision" }));
  const rejectedDraft = await edit(await draft(), "SHOW"); const rejectedSent = await send(rejectedDraft); const rq = await reply(rejectedSent.request.id, 510);
  const reject = { userId: parent.id, orderId: rejectedDraft.id, requestId: rejectedSent.request.id, quoteId: rq.quote.id, expectedVersion: 1 };
  await rejectPartyQuote(reject); assert.equal((await rejectPartyQuote(reject)).alreadyRejected, true);
  await failure(409, () => acceptPartyQuote(reject));
  assert.equal((await readPartyOrder(parent.id, rejectedDraft.id)).status, "NEEDS_ALTERNATIVE");
  const declinedDraft = await edit(await draft(), "SHOW"); const declinedSent = await send(declinedDraft);
  await replyToPartyRequest({ businessId: business.id, actorUserId: owner.id, requestId: declinedSent.request.id, idempotencyKey: key + "decline",
    input: { type: "DECLINED", expectedStage: "SENT", expectedQuoteVersion: 0, declineReason: "FORMAT", declineComment: "Не можем изменить программу" } });
  assert.equal((await readPartyOrder(parent.id, declinedDraft.id)).status, "NEEDS_ALTERNATIVE");
  await prisma.packageComponent.updateMany({ where: { packageId: offer.id, category: "ANIMATOR" }, data: { removalCreditByn: 500 } });
  const zeroBase = await edit(await draft(), "ANIMATOR");
  const zeroDraft = await updatePartyDraft(parent.id, zeroBase.id, { version: zeroBase.version, timeFrom: "16:00", timeTo: "18:00" });
  const zeroSent = await send(zeroDraft);
  const zeroReply = await replyToPartyRequest({ businessId: business.id, actorUserId: owner.id, requestId: zeroSent.request.id, idempotencyKey: key + "zero",
    input: { type: "AS_REQUESTED", expectedStage: "SENT", expectedQuoteVersion: 0, priceByn: 0, includes: "Без аниматора, итог ноль" } });
  await acceptPartyQuote({ userId: parent.id, orderId: zeroDraft.id, requestId: zeroSent.request.id, quoteId: zeroReply.quote.id, expectedVersion: 1 });
  await confirmPartyRequest({ ...confirmation, requestId: zeroSent.request.id, expectedQuoteVersion: 1, idempotencyKey: key + "zero-confirm" });
  assert.equal((await readPartyOrder(parent.id, zeroDraft.id)).items.find(i => i.role === "ANCHOR")?.offerPriceSnapshot?.toFixed(2), "0.00");
  assert.equal(await prisma.partyOutbox.count({ where: { aggregateId: sent.request.id, eventType: "PARTY_REQUEST_SENT" } }), 1);
  const concurrentBase = await edit(await draft(), "FOOD");
  const concurrentDraft = await updatePartyDraft(parent.id, concurrentBase.id, { version: concurrentBase.version, timeFrom: "18:00", timeTo: "20:00" });
  const concurrentSent = await send(concurrentDraft);
  const firstRequest = await prisma.bookingRequest.findUniqueOrThrow({ where: { id: concurrentSent.request.id } });
  const sibling = await prisma.bookingRequest.create({ data: { businessId: business.id, userId: parent.id,
    publicationType: "OFFER", offerId: offer.id, kind: "PARTY", partyOrderItemId: firstRequest.partyOrderItemId,
    partyStage: "SENT", status: "NEW", requestedDate: firstRequest.requestedDate, requestedTime: "18:00",
    adultsCount: 4, childrenCount: 8, responseDueAt: firstRequest.responseDueAt } });
  const qa = await reply(concurrentSent.request.id, 500);
  const qb = await reply(sibling.id, 500);
  await acceptPartyQuote({ userId: parent.id, orderId: concurrentDraft.id, requestId: sibling.id, quoteId: qb.quote.id, expectedVersion: 1 });
  const competing = await Promise.allSettled([
    rejectPartyQuote({ userId: parent.id, orderId: concurrentDraft.id, requestId: concurrentSent.request.id, quoteId: qa.quote.id, expectedVersion: 1 }),
    confirmPartyRequest({ ...confirmation, requestId: sibling.id, expectedQuoteVersion: 1, idempotencyKey: key + "competing" }),
  ]);
  assert.equal(competing[1].status, "fulfilled", "confirmation must not deadlock with sibling rejection");
  for (const result of competing) if (result.status === "rejected") assert.ok(result.reason instanceof PartyApiError && result.reason.status === 409);
  assert.equal(await prisma.bookingAllocation.count({ where: { bookingRequestId: sibling.id, status: "CONFIRMED" } }), 1);
  for (const mode of ["FROM", "ON_REQUEST"] as const) {
    const d = await edit(await draft(mode), "FOOD"); const request = await send(d);
    const scope = readPackageChangeScope((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: request.request.id } })).bookingPriceSnapshot)!;
    assert.equal(scope.requestedPrice.mode, mode);
    const q = await reply(request.request.id, 550);
    await prisma.partyQuote.update({ where: { id: q.quote.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    await failure(410, () => acceptPartyQuote({ userId: parent.id, orderId: d.id, requestId: request.request.id, quoteId: q.quote.id, expectedVersion: 1 }));
  }
  console.log("PASS unchanged, four policies, frozen prices, replacement, CAS, owner ACL, quote versions/expiry, accept/reject, real allocation, replay and third-party isolation");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
