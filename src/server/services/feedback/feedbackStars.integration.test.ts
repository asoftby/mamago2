import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getFeedbackSummary,
  listPublishedReviews,
  submitReviewText,
  submitStarRating,
  withdrawStarRating,
  type FeedbackUser,
} from "./feedback.service";
import { FeedbackDomainError, type FeedbackErrorCode } from "./feedbackErrors";
import { reconcileFeedbackAggregates } from "./feedbackAggregate.service";
import { minskDate } from "./feedbackOccurrence";

/**
 * Feedback 5★ write path against an isolated PostgreSQL (CI postgres-integration job).
 * Covers occurrence validation, revisions, aggregates per projection, review text
 * moderation states, withdrawal and the reconcile job.
 */
if (!process.env.DATABASE_URL) throw new Error("Isolated PostgreSQL database required");

const tag = randomUUID().slice(0, 8);
const now = new Date();
const daysAgo = (n: number) => minskDate(new Date(now.getTime() - n * 86_400_000));
const userIds: string[] = [];
const targetIds: string[] = [];
let businessId = "";

async function expectCode(promise: Promise<unknown>, code: FeedbackErrorCode) {
  await assert.rejects(promise, (error: unknown) => error instanceof FeedbackDomainError && error.code === code, `expected ${code}`);
}

async function direct(targetType: "PLACE" | "EVENT" | "OFFER" | "BUSINESS", targetId: string, projection = "DIRECT") {
  return prisma.feedbackReputationAggregate.findUnique({
    where: { targetType_targetId_projection: { targetType, targetId, projection: projection as "DIRECT" } },
  });
}

async function main() {
  const [owner, raterRow, rater2Row, strangerRow] = await Promise.all(
    ["owner", "rater", "rater2", "stranger"].map((name) =>
      prisma.user.create({ data: { email: `fb5-${tag}-${name}@example.invalid` } })),
  );
  userIds.push(owner.id, raterRow.id, rater2Row.id, strangerRow.id);
  const rater: FeedbackUser = { id: raterRow.id, phoneE164: null, phoneVerifiedAt: null };
  const rater2: FeedbackUser = { id: rater2Row.id, phoneE164: null, phoneVerifiedAt: null };

  businessId = (await prisma.business.create({ data: { name: `fb5-${tag}`, ownerUserId: owner.id } })).id;
  const place = await prisma.place.create({ data: {
    title: `FB5 place ${tag}`, shortDesc: "fixture", createdByUserId: owner.id, ownerBusinessId: businessId,
    status: "PUBLISHED", category: "play", activityTypes: [], ageTags: [], visitFormats: [],
  } });
  const activity = await prisma.activity.create({ data: {
    ownerUserId: owner.id, title: `FB5 event ${tag}`, shortDesc: "fixture", type: "EVENT", status: "PUBLISHED",
    scheduleMode: "MULTI_DATE", schedulingKind: "SLOT", scheduleJson: { durationMinutes: 60 },
  } });
  await prisma.eventVenue.create({ data: { activityId: activity.id, kind: "PLACE", placeId: place.id } });
  const pastSession = await prisma.activitySession.create({ data: { activityId: activity.id, startsAt: new Date(now.getTime() - 3 * 86_400_000) } });
  const futureSession = await prisma.activitySession.create({ data: { activityId: activity.id, startsAt: new Date(now.getTime() + 3 * 86_400_000) } });
  const partyOffer = await prisma.offer.create({ data: {
    kind: "SERVICE", productType: "PARTY_SERVICE", category: "ANIMATOR", title: `FB5 party ${tag}`, placeId: place.id, status: "PUBLISHED",
  } });
  const visitOffer = await prisma.offer.create({ data: {
    kind: "SERVICE", productType: "PLACE_VISIT", title: `FB5 visit ${tag}`, placeId: place.id, status: "PUBLISHED",
  } });
  targetIds.push(place.id, activity.id, partyOffer.id, visitOffer.id, businessId);
  const booking = await prisma.bookingRequest.create({ data: {
    businessId, publicationType: "OFFER", offerId: partyOffer.id, placeId: place.id, userId: rater.id, status: "COMPLETED",
    customerName: "FB5 rater", customerPhone: "+375290000001",
    startsAt: new Date(now.getTime() - 86_400_000), completedAt: now,
  } });
  const foreignBooking = await prisma.bookingRequest.create({ data: {
    businessId, publicationType: "OFFER", offerId: partyOffer.id, placeId: place.id, userId: strangerRow.id, status: "COMPLETED",
    customerName: "FB5 stranger", customerPhone: "+375290000002",
  } });
  const animatorTag = await prisma.feedbackTag.create({ data: {
    key: `fb5-punctual-${tag}`, label: "Пунктуальность", scope: "PROGRAM", showFor: [4, 5], targetTypes: ["OFFER"], partyCategories: ["ANIMATOR"],
  } });

  // 1. Place visit: create, then re-rate the same visit (update + history).
  const first = await submitStarRating({ user: rater, targetType: "PLACE", targetId: place.id, value: 5, occurrence: { kind: "visit", date: daysAgo(2) } });
  assert.equal(first.created, true);
  const again = await submitStarRating({ user: rater, targetType: "PLACE", targetId: place.id, value: 3, occurrence: { kind: "visit", date: daysAgo(2) } });
  assert.equal(again.reactionId, first.reactionId);
  assert.equal(again.created, false);
  assert.equal(await prisma.feedbackRevision.count({ where: { reactionId: first.reactionId } }), 2);
  const stored = await prisma.feedbackReaction.findUniqueOrThrow({ where: { id: first.reactionId } });
  assert.equal(stored.scale, "STARS5");
  assert.equal(stored.isPublicEligible, true, "stars are public without a verified phone");
  assert.equal(stored.occurrenceKey, `visit:${daysAgo(2)}`);
  let agg = await direct("PLACE", place.id);
  assert.equal(agg?.ratingCount, 1);
  assert.equal(agg?.ratingAverage, 3);

  // 2. A second visit by the same author counts once (latest rating wins).
  await submitStarRating({ user: rater, targetType: "PLACE", targetId: place.id, value: 4, occurrence: { kind: "visit", date: daysAgo(1) } });
  await submitStarRating({ user: rater2, targetType: "PLACE", targetId: place.id, value: 5, occurrence: { kind: "visit", date: daysAgo(1) } });
  agg = await direct("PLACE", place.id);
  assert.equal(agg?.ratingCount, 2);
  assert.equal(agg?.ratingSum, 9);
  assert.equal(agg?.c4, 1);
  assert.equal(agg?.c5, 1);
  assert.ok(agg?.rankScore != null && agg.rankScore > 1 && agg.rankScore < 5);

  // 3. Occurrence validation.
  await expectCode(submitStarRating({ user: rater, targetType: "PLACE", targetId: place.id, value: 5, occurrence: { kind: "visit", date: minskDate(new Date(now.getTime() + 2 * 86_400_000)) } }), "OCCURRENCE_NOT_STARTED");
  await expectCode(submitStarRating({ user: rater, targetType: "EVENT", targetId: activity.id, value: 5, occurrence: { kind: "session", id: futureSession.id } }), "OCCURRENCE_NOT_STARTED");
  await expectCode(submitStarRating({ user: rater, targetType: "EVENT", targetId: activity.id, value: 5, occurrence: { kind: "visit", date: daysAgo(1) } }), "OCCURRENCE_NOT_ALLOWED");
  await expectCode(submitStarRating({ user: rater, targetType: "OFFER", targetId: partyOffer.id, value: 5, occurrence: { kind: "booking", id: foreignBooking.id } }), "OCCURRENCE_NOT_FOUND");
  await expectCode(submitStarRating({ user: rater, targetType: "OFFER", targetId: visitOffer.id, value: 5, occurrence: { kind: "booking", id: booking.id } }), "OFFER_INHERITS_PLACE");
  await expectCode(submitStarRating({ user: rater, targetType: "ARTICLE", targetId: "x", value: 5, occurrence: { kind: "visit", date: daysAgo(1) } }), "TARGET_NOT_RATEABLE");
  await expectCode(submitStarRating({ user: rater, targetType: "PLACE", targetId: place.id, value: 0, occurrence: { kind: "visit", date: daysAgo(1) } }), "INVALID_VALUE");
  await expectCode(submitStarRating({ user: rater, targetType: "PLACE", targetId: place.id, value: 5, experienceLevel: "TRIAL", occurrence: { kind: "visit", date: daysAgo(1) } }), "EXPERIENCE_LEVEL_NOT_APPLICABLE");

  // 4. Event session: self-reported, venue snapshot feeds the place's LINKED_EVENT projection.
  const eventRating = await submitStarRating({ user: rater, targetType: "EVENT", targetId: activity.id, value: 4, occurrence: { kind: "session", id: pastSession.id } });
  const eventRow = await prisma.feedbackReaction.findUniqueOrThrow({ where: { id: eventRating.reactionId } });
  assert.equal(eventRow.visitStatus, "SELF_REPORTED");
  assert.equal(eventRow.activitySessionId, pastSession.id);
  assert.equal(eventRow.venuePlaceIdAtVisit, place.id);
  assert.equal((await direct("EVENT", activity.id))?.ratingCount, 1);
  assert.equal((await direct("PLACE", place.id, "LINKED_EVENT"))?.ratingCount, 1);
  assert.equal((await direct("PLACE", place.id))?.ratingCount, 2, "event ratings never leak into the place's own rating");

  // 5. Party service via a completed booking: verified, party chip, performer rollup.
  await expectCode(submitStarRating({ user: rater, targetType: "OFFER", targetId: partyOffer.id, value: 2, tagIds: [animatorTag.id], occurrence: { kind: "booking", id: booking.id } }), "INVALID_TAG");
  const party = await submitStarRating({ user: rater, targetType: "OFFER", targetId: partyOffer.id, value: 5, tagIds: [animatorTag.id], occurrence: { kind: "booking", id: booking.id } });
  const partyRow = await prisma.feedbackReaction.findUniqueOrThrow({ where: { id: party.reactionId } });
  assert.equal(partyRow.visitStatus, "VERIFIED");
  assert.equal(partyRow.bookingRequestId, booking.id);
  const partyAgg = await direct("OFFER", partyOffer.id);
  assert.equal(partyAgg?.verifiedCount, 1);
  assert.deepEqual((partyAgg?.tagStats as Record<string, unknown>)[animatorTag.key], { selected: 1, eligible: 1 });
  assert.equal((await direct("BUSINESS", businessId, "BUSINESS_ROLLUP"))?.ratingCount, 1);
  assert.equal((await direct("PLACE", place.id, "LINKED_OFFER"))?.ratingCount, 1);

  // 6. PLACE_VISIT offers show the place's rating, labelled as inherited.
  const inherited = await getFeedbackSummary({ targetType: "OFFER", targetId: visitOffer.id });
  assert.deepEqual(inherited.inheritedFrom, { targetType: "PLACE", targetId: place.id });
  assert.equal(inherited.rating.count, 2);
  assert.equal(inherited.rating.presentation, "Пока мало оценок · 2");
  assert.equal(inherited.linked?.events.count, 1);

  // 7. Review text: phone required; pending until moderated; edits keep the published text visible.
  await expectCode(submitReviewText({ user: rater, reactionId: first.reactionId, text: "Отлично" }), "PHONE_NOT_VERIFIED");
  const verifiedRater: FeedbackUser = { ...rater, phoneE164: "+375290000000", phoneVerifiedAt: now };
  await expectCode(submitReviewText({ user: { ...verifiedRater, id: rater2.id }, reactionId: first.reactionId, text: "Чужое" }), "REACTION_NOT_FOUND");
  assert.deepEqual(await submitReviewText({ user: verifiedRater, reactionId: first.reactionId, text: "Первый текст" }), { status: "PENDING" });
  assert.equal((await listPublishedReviews({ targetType: "PLACE", targetId: place.id })).reviews.length, 0, "pending text is not public");
  await prisma.feedbackReview.update({ where: { reactionId: first.reactionId }, data: { status: "PUBLISHED", moderatedAt: now } });
  await submitReviewText({ user: verifiedRater, reactionId: first.reactionId, text: "Исправленный текст" });
  const review = await prisma.feedbackReview.findUniqueOrThrow({ where: { reactionId: first.reactionId } });
  assert.equal(review.status, "PENDING");
  assert.equal(review.publishedText, "Первый текст");
  const listed = await listPublishedReviews({ targetType: "PLACE", targetId: place.id });
  assert.equal(listed.reviews.length, 1);
  assert.equal(listed.reviews[0].text, "Первый текст", "last approved text stays visible during re-moderation");

  // 8. Withdrawal leaves the aggregate; idempotent; re-rating restores.
  await withdrawStarRating({ userId: rater2.id, reactionId: (await prisma.feedbackReaction.findFirstOrThrow({ where: { userId: rater2.id } })).id });
  assert.equal((await direct("PLACE", place.id))?.ratingCount, 1);
  await withdrawStarRating({ userId: rater2.id, reactionId: (await prisma.feedbackReaction.findFirstOrThrow({ where: { userId: rater2.id } })).id });
  await expectCode(withdrawStarRating({ userId: rater2.id, reactionId: first.reactionId }), "REACTION_NOT_FOUND");

  // 9. Reconcile repairs a drifted aggregate and is a no-op when consistent.
  await prisma.feedbackReputationAggregate.update({
    where: { targetType_targetId_projection: { targetType: "EVENT", targetId: activity.id, projection: "DIRECT" } },
    data: { ratingCount: 2, ratingSum: 8, c4: 2 },
  });
  const repaired = await reconcileFeedbackAggregates(now);
  assert.ok(repaired.changed >= 1);
  assert.equal((await direct("EVENT", activity.id))?.ratingCount, 1);

  // 10. Concurrent writes: simultaneous first ratings of one object must not lose updates
  //     (per-aggregate advisory lock serialises the recompute; ТЗ 5.6). Repeated rounds raise the
  //     chance of catching an interleaving where each tx recomputes without seeing the other's row.
  const today = daysAgo(1);
  const rounds: number[][] = [[5, 3], [1, 4], [2, 2], [5, 5], [1, 5], [4, 3], [3, 1], [5, 1], [2, 4], [4, 4], [1, 2, 3, 4, 5, 5]];
  for (const [round, values] of rounds.entries()) {
    const racePlace = await prisma.place.create({ data: {
      title: `FB5 race ${round} ${tag}`, shortDesc: "fixture", createdByUserId: owner.id, ownerBusinessId: businessId,
      status: "PUBLISHED", category: "play", activityTypes: [], ageTags: [], visitFormats: [],
    } });
    targetIds.push(racePlace.id);
    const raters = await Promise.all(values.map((_, i) =>
      prisma.user.create({ data: { email: `fb5-${tag}-race-${round}-${i}@example.invalid` } })));
    userIds.push(...raters.map((u) => u.id));

    const results = await Promise.all(values.map((value, i) => submitStarRating({
      user: { id: raters[i].id, phoneE164: null, phoneVerifiedAt: null },
      targetType: "PLACE", targetId: racePlace.id, value, occurrence: { kind: "visit", date: today },
    })));
    assert.ok(results.every((r) => r.created), `round ${round}: every concurrent write succeeds`);

    const agg = await direct("PLACE", racePlace.id);
    assert.ok(agg, `round ${round}: aggregate exists`);
    const dist = [1, 2, 3, 4, 5].map((star) => values.filter((v) => v === star).length);
    assert.equal(agg.ratingCount, values.length, `round ${round}: no lost update (count)`);
    assert.equal(agg.ratingSum, values.reduce((a, b) => a + b, 0), `round ${round}: sum`);
    assert.deepEqual([agg.c1, agg.c2, agg.c3, agg.c4, agg.c5], dist, `round ${round}: distribution`);
    assert.equal(await prisma.feedbackReaction.count({ where: { targetType: "PLACE", targetId: racePlace.id, withdrawnAt: null } }), values.length);
    assert.ok(agg.rankScore !== null && agg.rankScore >= 1 && agg.rankScore <= 5, `round ${round}: rankScore in range`);

    // The lock-protected incremental result must equal a from-scratch recompute (no drift, no double count).
    await reconcileFeedbackAggregates(now);
    const after = await direct("PLACE", racePlace.id);
    assert.ok(after);
    assert.deepEqual(
      [after.ratingCount, after.ratingSum, after.c1, after.c2, after.c3, after.c4, after.c5, after.rankScore],
      [agg.ratingCount, agg.ratingSum, agg.c1, agg.c2, agg.c3, agg.c4, agg.c5, agg.rankScore],
      `round ${round}: concurrent result equals full recompute`,
    );
  }

  console.log("✅ feedback 5★ write path integration test");
}

async function cleanup() {
  await prisma.rateLimitEntry.deleteMany({ where: { OR: userIds.flatMap((id) => [{ key: `feedback_star:${id}` }, { key: `feedback_text:${id}` }]) } });
  await prisma.feedbackReaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.feedbackReputationAggregate.deleteMany({ where: { targetId: { in: targetIds } } });
  await prisma.feedbackTag.deleteMany({ where: { key: { contains: tag } } });
  await prisma.bookingRequest.deleteMany({ where: { businessId } });
  await prisma.offer.deleteMany({ where: { title: { contains: tag } } });
  await prisma.activity.deleteMany({ where: { title: { contains: tag } } });
  await prisma.place.deleteMany({ where: { title: { contains: tag } } });
  if (businessId) await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    await cleanup().catch((error) => console.error("cleanup failed", error));
    await prisma.$disconnect();
  });
