/**
 * PR A (decisionContext.v1) integration tests: attribution security,
 * subjects snapshotting, guest tracing, and a PII scan over everything
 * these tests wrote to UserEvent/RecommendationRun.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/lib/decision/decisionAttribution.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, AnalyticsEntityType, RecommendationSurface } from "@prisma/client";
import { trackUserEvent, trackFirstOccurrenceEvent } from "@/server/services/analytics/AnalyticsEventService";
import {
  recordRecommendationRun,
  verifyRecommendationAttribution,
} from "@/server/services/recommendations/RecommendationTraceService";
import {
  buildSubjectsSnapshot,
  findMostRecentSubjectsSnapshot,
  recordPlanAudienceSnapshot,
} from "@/lib/decision/subjects";
import { DecisionContextV1Schema, type Subject } from "@/lib/decision/decisionContext";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

// `@/lib/prisma` (imported transitively by the service modules above) reads
// DATABASE_URL from the environment at import time, so this script must be
// invoked as `DATABASE_URL=<isolated-db-url> npx tsx ...` — set in the shell,
// not assigned here (too late — imports are hoisted).
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const marker = randomUUID().slice(0, 8);
const CHILD_NAME = `pii-marker-name-${marker}`;

const userIds: string[] = [];
const otherUserIds: string[] = [];
const childIds: string[] = [];
const runIds: string[] = [];
const eventIds: string[] = [];

async function makeUser(): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `decision-attr-${marker}-${randomUUID()}@example.invalid` },
  });
  userIds.push(user.id);
  return user.id;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// linkRecommendationOutcome is fire-and-forget inside trackUserEvent, so a
// positive check must poll and a negative check must give it time to (not) land.
async function outcomeFor(userEventId: string, { expect }: { expect: boolean }) {
  for (let i = 0; i < 20; i++) {
    const row = await prisma.recommendationOutcome.findFirst({ where: { userEventId } });
    if (row) return row;
    if (!expect && i >= 5) break;
    await sleep(100);
  }
  return null;
}

async function main() {
  try {
    const owner = await makeUser();
    const stranger = await makeUser();
    otherUserIds.push(stranger);

    const child = await prisma.child.create({
      data: {
        name: CHILD_NAME,
        birthDate: new Date("2022-06-01"), // ~4 years old relative to a 2026 target date
        parentId: owner,
      },
    });
    childIds.push(child.id);

    // ---- 2. buildSubjectsSnapshot: ownership filtering ----
    const ownedSubjects = await buildSubjectsSnapshot({
      userId: owner,
      personaIds: [owner, child.id],
      targetDate: "2026-09-30",
    });
    assert.equal(ownedSubjects.length, 2, "adult + owned child both resolve");
    const adultSubject = ownedSubjects.find((s) => s.kind === "adult");
    const childSubject = ownedSubjects.find((s) => s.kind === "child");
    assert.equal(adultSubject?.refId, owner);
    assert.equal(childSubject?.refId, child.id);
    assert.equal(childSubject?.ageRange, "3-5", "4y old on 2026-09-30 buckets to 3-5");
    assert.equal("name" in (childSubject ?? {}), false, "subject never carries a name field");
    assert.equal("birthDate" in (childSubject ?? {}), false, "subject never carries a birthDate field");

    const strangerAttemptsToReadChild = await buildSubjectsSnapshot({
      userId: stranger,
      personaIds: [child.id],
      targetDate: "2026-09-30",
    });
    assert.deepEqual(
      strangerAttemptsToReadChild,
      [],
      "a personaId for another user's child must never resolve",
    );

    // ---- 1 & guest tracing: recordRecommendationRun with anonymousId ----
    const anonymousId = randomUUID();
    const activityIdA = `activity-${marker}-a`;
    const activityIdB = `activity-${marker}-b`;
    const guestTrace = await recordRecommendationRun({
      anonymousId,
      surface: RecommendationSurface.MY_PLAN,
      citySlug: "minsk",
      targetDateFrom: "2026-09-30",
      targetDateTo: "2026-09-30",
      algorithmVersion: "test-v1",
      candidateCount: 2,
      decisionContext: {
        intent: "guest_plan_generate",
        subjects: [{ kind: "child", refId: null, ageRange: "3-5", source: "manual" }],
        actor: { kind: "guest", id: anonymousId },
      },
      items: [
        { entityType: AnalyticsEntityType.EVENT, entityId: activityIdA, position: 1 },
        { entityType: AnalyticsEntityType.EVENT, entityId: activityIdB, position: 2 },
      ],
    });
    assert.ok(guestTrace, "guest run was recorded");
    runIds.push(guestTrace!.runId);
    const guestRunRow = await prisma.recommendationRun.findUniqueOrThrow({
      where: { id: guestTrace!.runId },
    });
    assert.equal(guestRunRow.userId, null, "guest run has no userId");
    assert.equal(guestRunRow.anonymousId, anonymousId, "guest run carries the anonymousId");
    const guestExposures = await prisma.recommendationExposure.findMany({
      where: { runId: guestTrace!.runId },
    });
    assert.equal(guestExposures.length, 2, "both exposures were recorded");

    // ---- P1 finding 1: persisted context is schema-valid, decisionId === RecommendationRun.id ----
    const guestParsedContext = DecisionContextV1Schema.parse(guestRunRow.context);
    assert.equal(guestParsedContext.decisionId, guestTrace!.runId, "persisted decisionId equals the run's own id");
    assert.equal(guestParsedContext.intent, "guest_plan_generate");
    assert.equal(guestParsedContext.actor.kind, "guest");
    assert.equal(guestParsedContext.actor.id, anonymousId);

    // ---- authenticated run, for attribution tests ----
    const authedRun = await recordRecommendationRun({
      userId: owner,
      surface: RecommendationSurface.MY_PLAN,
      citySlug: "minsk",
      targetDateFrom: "2026-09-30",
      targetDateTo: "2026-09-30",
      algorithmVersion: "test-v1",
      candidateCount: 1,
      decisionContext: {
        intent: "my_plan_suggestions",
        subjects: [{ kind: "adult", refId: owner, source: "profile" }],
        actor: { kind: "user", id: owner },
      },
      items: [{ entityType: AnalyticsEntityType.EVENT, entityId: activityIdA, position: 1 }],
    });
    assert.ok(authedRun);
    runIds.push(authedRun!.runId);
    const ownerExposureId = authedRun!.exposureIdByEntityKey.get(`EVENT:${activityIdA}`)!;
    assert.ok(ownerExposureId);

    const authedRunRow = await prisma.recommendationRun.findUniqueOrThrow({
      where: { id: authedRun!.runId },
    });
    const authedParsedContext = DecisionContextV1Schema.parse(authedRunRow.context);
    assert.equal(authedParsedContext.decisionId, authedRun!.runId);
    assert.equal(authedParsedContext.actor.kind, "user");
    assert.equal(authedParsedContext.actor.id, owner);

    // ---- 3. valid attribution ----
    const validAttribution = await verifyRecommendationAttribution({
      exposureId: ownerExposureId,
      entityType: AnalyticsEntityType.EVENT,
      entityId: activityIdA,
      userId: owner,
    });
    assert.deepEqual(validAttribution, { exposureId: ownerExposureId, runId: authedRun!.runId });

    // ---- 4. entity mismatch -> null ----
    const wrongEntity = await verifyRecommendationAttribution({
      exposureId: ownerExposureId,
      entityType: AnalyticsEntityType.EVENT,
      entityId: activityIdB, // exposure is actually for activityIdA
      userId: owner,
    });
    assert.equal(wrongEntity, null, "entity mismatch must not verify");

    // ---- 5. foreign user -> null ----
    const foreignUser = await verifyRecommendationAttribution({
      exposureId: ownerExposureId,
      entityType: AnalyticsEntityType.EVENT,
      entityId: activityIdA,
      userId: stranger,
    });
    assert.equal(foreignUser, null, "another user's id must not verify someone else's exposure");

    // ---- 6. foreign anonymous actor -> null ----
    const foreignAnonymous = await verifyRecommendationAttribution({
      exposureId: guestTrace!.exposureIdByEntityKey.get(`EVENT:${activityIdA}`)!,
      entityType: AnalyticsEntityType.EVENT,
      entityId: activityIdA,
      anonymousId: randomUUID(), // NOT the anonymousId that owns the guest run
    });
    assert.equal(foreignAnonymous, null, "a different anonymousId must not verify a guest exposure");

    // ---- 7. end-to-end trackUserEvent: valid explicit attribution sets decisionId ----
    const trackResult1 = await trackUserEvent({
      userId: owner,
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: activityIdA,
      meta: { source: "recommendation", recommendationExposureId: ownerExposureId },
    });
    assert.equal(trackResult1.ok, true);
    const savedValid = await prisma.userEvent.findFirst({
      where: { userId: owner, eventType: "PLAN_ADD", entityId: activityIdA },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(savedValid);
    eventIds.push(savedValid!.id);
    assert.equal(savedValid!.decisionId, authedRun!.runId, "verified explicit attribution sets decisionId");

    // ---- unverified explicit attribution must NOT set decisionId, and must be stripped from meta ----
    const trackResult2 = await trackUserEvent({
      userId: stranger,
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: activityIdA,
      meta: { source: "recommendation", recommendationExposureId: ownerExposureId }, // stranger claims owner's exposure
    });
    assert.equal(trackResult2.ok, true);
    const savedInvalid = await prisma.userEvent.findFirst({
      where: { userId: stranger, eventType: "PLAN_ADD", entityId: activityIdA },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(savedInvalid);
    eventIds.push(savedInvalid!.id);
    assert.equal(savedInvalid!.decisionId, null, "unverified explicit attribution must NOT set decisionId");
    const invalidMeta = savedInvalid!.meta as Record<string, unknown> | null;
    assert.equal(
      invalidMeta && "recommendationExposureId" in invalidMeta,
      false,
      "unverified exposure id must be stripped from meta, not persisted",
    );

    // No RecommendationOutcome should have been created for the forged attempt.
    const forgedOutcome = await prisma.recommendationOutcome.findFirst({
      where: { userEventId: savedInvalid!.id },
    });
    assert.equal(forgedOutcome, null, "forged attribution must not create a RecommendationOutcome");

    // ---- guest anonymousId persisted on UserEvent ----
    const trackResultGuest = await trackUserEvent({
      anonymousId,
      eventType: "CARD_VIEW",
      entityType: "EVENT",
      entityId: activityIdA,
    });
    assert.equal(trackResultGuest.ok, true);
    const savedGuestEvent = await prisma.userEvent.findFirst({
      where: { anonymousId, eventType: "CARD_VIEW" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(savedGuestEvent);
    eventIds.push(savedGuestEvent!.id);
    assert.equal(savedGuestEvent!.anonymousId, anonymousId);

    // ---- P1 finding 2: guest -> post-auth continuity, without rewriting guest history ----
    const newlyAuthedUser = await makeUser();

    // Same guest anonymousId, now carried alongside a real userId (as the
    // client does post-registration) -> the guest run (userId=null,
    // anonymousId=<guest>) is still found via the fallback lookup, entirely
    // by anonymousId ownership. No explicit exposureId is supplied here —
    // this exercises the exact "old call sites, no UI plumbing" path.
    const postAuthAttributed = await trackUserEvent({
      userId: newlyAuthedUser,
      anonymousId,
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: activityIdB, // guestTrace exposed this one too (position 2)
      meta: { source: "recommendation" },
    });
    assert.equal(postAuthAttributed.ok, true);
    const savedPostAuthEvent = await prisma.userEvent.findFirst({
      where: { userId: newlyAuthedUser, eventType: "PLAN_ADD", entityId: activityIdB },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(savedPostAuthEvent);
    eventIds.push(savedPostAuthEvent!.id);
    assert.equal(
      savedPostAuthEvent!.decisionId,
      guestTrace!.runId,
      "post-auth action attributed back to the original guest run via matching anonymousId",
    );
    // The guest run's own ownership is untouched — never rewritten to userId.
    const guestRunAfterAuth = await prisma.recommendationRun.findUniqueOrThrow({
      where: { id: guestTrace!.runId },
    });
    assert.equal(guestRunAfterAuth.userId, null, "guest run history is never rewritten to carry a userId");
    assert.equal(guestRunAfterAuth.anonymousId, anonymousId);

    // Wrong anonymousId (not the guest run's) + a userId with no owned run
    // for this entity either -> no match, decisionId stays null.
    const postAuthWrongAnonymous = await trackUserEvent({
      userId: newlyAuthedUser,
      anonymousId: randomUUID(),
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: activityIdA,
      meta: { source: "recommendation" },
    });
    assert.equal(postAuthWrongAnonymous.ok, true);
    const savedWrongAnon = await prisma.userEvent.findFirst({
      where: { userId: newlyAuthedUser, eventType: "PLAN_ADD", entityId: activityIdA },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(savedWrongAnon);
    eventIds.push(savedWrongAnon!.id);
    assert.equal(
      savedWrongAnon!.decisionId,
      null,
      "a non-matching anonymousId (and no owned run) must not produce an attribution",
    );

    // ---- 8. findMostRecentSubjectsSnapshot (PLAN_REMOVE derivation) ----
    const placeEntityId = `place-${marker}`;
    const planItemIdOld = `planitem-${marker}-old`;

    const planAddWithSubjects = await trackUserEvent({
      userId: owner,
      eventType: "PLAN_ADD",
      entityType: "PLACE",
      entityId: placeEntityId,
      meta: {
        planItemId: planItemIdOld,
        dateFrom: "2026-10-01",
        dateTo: "2026-10-01",
        subjects: [{ kind: "child", refId: child.id, ageRange: "3-5", source: "profile" }],
        decisionContextVersion: 1,
      },
    });
    assert.equal(planAddWithSubjects.ok, true);
    const savedPlanAdd = await prisma.userEvent.findFirst({
      where: { userId: owner, eventType: "PLAN_ADD", entityType: "PLACE", entityId: placeEntityId },
      orderBy: { createdAt: "desc" },
    });
    eventIds.push(savedPlanAdd!.id);

    const derived = await findMostRecentSubjectsSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.PLACE,
      entityId: placeEntityId,
      planItemId: planItemIdOld,
      currentDate: "2026-10-01",
    });
    assert.equal(derived.length, 1);
    assert.equal(derived[0]!.source, "derived", "recovered snapshot is re-tagged as derived, not profile");
    assert.equal(derived[0]!.refId, child.id);

    // ---- P2 finding 4: never inherit a stale snapshot after the item moved ----

    // Item "moved" to a different date (2026-10-05) with no fresh PLAN_ADD
    // recorded for it — a remove there must get [] , never date-A's subjects.
    const staleAttempt = await findMostRecentSubjectsSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.PLACE,
      entityId: placeEntityId,
      planItemId: planItemIdOld,
      currentDate: "2026-10-05",
    });
    assert.deepEqual(staleAttempt, [], "moved item without a fresh snapshot must get [], never date A's stale audience");

    // A fresh PLAN_ADD recorded for the SAME planItemId at the NEW date
    // (e.g. a real re-add) must resolve to the CURRENT snapshot, not A's.
    const planAddDateB = await trackUserEvent({
      userId: owner,
      eventType: "PLAN_ADD",
      entityType: "PLACE",
      entityId: placeEntityId,
      meta: {
        planItemId: planItemIdOld,
        dateFrom: "2026-10-05",
        dateTo: "2026-10-05",
        subjects: [{ kind: "child", refId: child.id, ageRange: "5-7", source: "profile" }],
        decisionContextVersion: 1,
      },
    });
    assert.equal(planAddDateB.ok, true);
    const savedPlanAddB = await prisma.userEvent.findFirst({
      where: { userId: owner, eventType: "PLAN_ADD", entityType: "PLACE", entityId: placeEntityId },
      orderBy: { createdAt: "desc" },
    });
    eventIds.push(savedPlanAddB!.id);

    const freshSnapshot = await findMostRecentSubjectsSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.PLACE,
      entityId: placeEntityId,
      planItemId: planItemIdOld,
      currentDate: "2026-10-05",
    });
    assert.equal(freshSnapshot.length, 1);
    assert.equal(freshSnapshot[0]!.ageRange, "5-7", "resolves the CURRENT (date B) snapshot, not the stale date-A one");

    // A different planItemId must never borrow another item's snapshot.
    const unrelatedPlanItem = await findMostRecentSubjectsSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.PLACE,
      entityId: placeEntityId,
      planItemId: `planitem-${marker}-unrelated`,
      currentDate: "2026-10-05",
    });
    assert.deepEqual(unrelatedPlanItem, [], "a different planItemId must never inherit another item's snapshot");

    // ---- 9. trackFirstOccurrenceEvent: once-only ----
    const marker9Type = "FIRST_PERSONALIZED_RESULT" as const;
    const first1 = await trackFirstOccurrenceEvent({ userId: owner, eventType: marker9Type });
    void first1;
    const afterFirst = await prisma.userEvent.count({ where: { userId: owner, eventType: marker9Type } });
    assert.equal(afterFirst, 1, "first call recorded exactly one milestone event");
    const savedMilestone = await prisma.userEvent.findFirst({
      where: { userId: owner, eventType: marker9Type },
    });
    eventIds.push(savedMilestone!.id);

    await trackFirstOccurrenceEvent({ userId: owner, eventType: marker9Type });
    const afterSecond = await prisma.userEvent.count({ where: { userId: owner, eventType: marker9Type } });
    assert.equal(afterSecond, 1, "second call must NOT record a duplicate milestone event");

    // ---- follow-up: post-auth /api/save/plan chain with EXPLICIT anonymousId + exposureId ----
    // RecommendationRun(userId=null, anonymousId=A) -> Exposure E
    //   -> post-auth save (userId=U, anonymousId=A, exposureId=E)
    //   -> UserEvent(userId=U, anonymousId=A, decisionId=original run) -> RecommendationOutcome(E)
    const guestExposureB = guestTrace!.exposureIdByEntityKey.get(`EVENT:${activityIdB}`)!;
    const bridgeUser = await makeUser();
    assert.equal(
      (await trackUserEvent({
        userId: bridgeUser,
        anonymousId,
        eventType: "PLAN_ADD",
        entityType: "EVENT",
        entityId: activityIdB,
        meta: { source: "recommendation", planAddSource: "recommendation", recommendationExposureId: guestExposureB },
      })).ok,
      true,
    );
    const bridged = await prisma.userEvent.findFirst({
      where: { userId: bridgeUser, eventType: "PLAN_ADD", entityId: activityIdB },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(bridged);
    eventIds.push(bridged!.id);
    assert.equal(bridged!.anonymousId, anonymousId, "UserEvent keeps the guest anonymousId next to userId");
    assert.equal(bridged!.decisionId, guestTrace!.runId, "attributed to the ORIGINAL guest run");
    const bridgedOutcome = await outcomeFor(bridged!.id, { expect: true });
    assert.ok(bridgedOutcome, "RecommendationOutcome(E) created for the bridged event");
    assert.equal(bridgedOutcome!.exposureId, guestExposureB);

    // Wrong anonymousId with the same explicit exposure -> no attribution, no outcome, id stripped.
    assert.equal(
      (await trackUserEvent({
        userId: bridgeUser,
        anonymousId: randomUUID(),
        eventType: "PLAN_ADD",
        entityType: "EVENT",
        entityId: activityIdB,
        meta: { source: "recommendation", recommendationExposureId: guestExposureB },
      })).ok,
      true,
    );
    const wrongAnonEvents = await prisma.userEvent.findMany({
      where: { userId: bridgeUser, eventType: "PLAN_ADD", entityId: activityIdB },
      orderBy: { createdAt: "desc" },
    });
    const wrongAnon = wrongAnonEvents[0]!;
    eventIds.push(wrongAnon.id);
    assert.notEqual(wrongAnon.id, bridged!.id);
    assert.equal(wrongAnon.decisionId, null, "wrong anonymousId must not attribute");
    assert.equal(await outcomeFor(wrongAnon.id, { expect: false }), null, "wrong anonymousId must not create an outcome");

    // Foreign exposure (someone else's guest run) -> no attribution.
    const otherGuestTrace = await recordRecommendationRun({
      anonymousId: randomUUID(),
      surface: RecommendationSurface.MY_PLAN,
      citySlug: "minsk",
      algorithmVersion: "test-v1",
      candidateCount: 1,
      decisionContext: { intent: "guest_plan_generate", subjects: [], actor: { kind: "guest", id: null } },
      items: [{ entityType: AnalyticsEntityType.EVENT, entityId: activityIdB, position: 1 }],
    });
    runIds.push(otherGuestTrace!.runId);
    assert.equal(
      (await trackUserEvent({
        userId: bridgeUser,
        anonymousId,
        eventType: "PLAN_ADD",
        entityType: "EVENT",
        entityId: activityIdB,
        meta: {
          source: "recommendation",
          recommendationExposureId: otherGuestTrace!.exposureIdByEntityKey.get(`EVENT:${activityIdB}`),
        },
      })).ok,
      true,
    );
    const foreignExposureEvent = (
      await prisma.userEvent.findMany({
        where: { userId: bridgeUser, eventType: "PLAN_ADD", entityId: activityIdB },
        orderBy: { createdAt: "desc" },
      })
    )[0]!;
    eventIds.push(foreignExposureEvent.id);
    assert.equal(foreignExposureEvent.decisionId, null, "another guest's exposure must not attribute");
    assert.equal(await outcomeFor(foreignExposureEvent.id, { expect: false }), null);

    // ---- follow-up: an invalid subject can never be persisted into a run's context ----
    const junkMarker = randomUUID();
    const junkRun = await recordRecommendationRun({
      anonymousId: junkMarker,
      surface: RecommendationSurface.MY_PLAN,
      citySlug: "minsk",
      algorithmVersion: "test-v1",
      candidateCount: 1,
      decisionContext: {
        intent: "guest_plan_generate",
        // Deliberately non-canonical free text, cast past the type system.
        subjects: [
          { kind: "child", refId: null, ageRange: "free text <script>", source: "manual" },
        ] as unknown as Subject[],
        actor: { kind: "guest", id: junkMarker },
      },
      items: [{ entityType: AnalyticsEntityType.EVENT, entityId: activityIdA, position: 1 }],
    });
    assert.equal(junkRun, null, "invalid context aborts the whole trace write");
    assert.equal(
      await prisma.recommendationRun.count({ where: { anonymousId: junkMarker } }),
      0,
      "transaction rolled back: no run row left behind with a missing/invalid context",
    );

    // ---- follow-up: same-date audience update must not leave a stale snapshot ----
    const snapshotPlaceId = `place-snap-${marker}`;
    const planItemP = `planitem-${marker}-snap`;
    const kidBefore = [{ kind: "child" as const, refId: child.id, ageRange: "3-5" as const, source: "profile" as const }];
    const kidAfter = [{ kind: "child" as const, refId: child.id, ageRange: "5-7" as const, source: "profile" as const }];

    // (a) create item date A subjects X; move to date B subjects Y; remove on B -> Y
    assert.equal(
      (await trackUserEvent({
        userId: owner,
        eventType: "PLAN_ADD",
        entityType: "EVENT",
        entityId: snapshotPlaceId,
        meta: { planItemId: planItemP, dateFrom: "2026-11-01", dateTo: "2026-11-01", subjects: kidBefore, decisionContextVersion: 1 },
      })).ok,
      true,
    );
    await sleep(15);
    await recordPlanAudienceSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.EVENT,
      entityId: snapshotPlaceId,
      planItemId: planItemP,
      date: "2026-11-02",
      subjects: kidAfter,
    });
    const movedRemove = await findMostRecentSubjectsSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.EVENT,
      entityId: snapshotPlaceId,
      planItemId: planItemP,
      currentDate: "2026-11-02",
    });
    assert.equal(movedRemove.length, 1);
    assert.equal(movedRemove[0]!.ageRange, "5-7", "moved A->B with new audience Y: remove on B yields Y");

    // (b) item already on date B with X; explicit update on the SAME date with Y -> Y, not X
    await sleep(15);
    await recordPlanAudienceSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.EVENT,
      entityId: snapshotPlaceId,
      planItemId: planItemP,
      date: "2026-11-02",
      subjects: kidBefore, // audience on B is X ...
    });
    await sleep(15);
    await recordPlanAudienceSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.EVENT,
      entityId: snapshotPlaceId,
      planItemId: planItemP,
      date: "2026-11-02",
      subjects: kidAfter, // ... then explicitly updated to Y on the same date
    });
    const sameDateRemove = await findMostRecentSubjectsSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.EVENT,
      entityId: snapshotPlaceId,
      planItemId: planItemP,
      currentDate: "2026-11-02",
    });
    assert.equal(sameDateRemove[0]!.ageRange, "5-7", "same-date update X->Y: remove yields Y, never stale X");

    // (c) audience explicitly cleared on the same date -> [] (never X or Y)
    await sleep(15);
    await recordPlanAudienceSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.EVENT,
      entityId: snapshotPlaceId,
      planItemId: planItemP,
      date: "2026-11-02",
      subjects: [],
    });
    assert.deepEqual(
      await findMostRecentSubjectsSnapshot({
        userId: owner,
        entityType: AnalyticsEntityType.EVENT,
        entityId: snapshotPlaceId,
        planItemId: planItemP,
        currentDate: "2026-11-02",
      }),
      [],
      "cleared audience beats any older non-empty snapshot",
    );

    // Snapshots are NOT positive signals: only the one real PLAN_ADD exists.
    const eventTypesForItem = await prisma.userEvent.groupBy({
      by: ["eventType"],
      where: { userId: owner, entityId: snapshotPlaceId },
      _count: true,
    });
    const countOf = (type: string) => eventTypesForItem.find((row) => row.eventType === type)?._count ?? 0;
    assert.equal(countOf("PLAN_ADD"), 1, "audience re-saves must not add PLAN_ADD rows");
    assert.equal(countOf("PLAN_AUDIENCE_SNAPSHOT"), 4, "each re-save is recorded as a distinct snapshot event");
    const snapshotRows = await prisma.userEvent.findMany({
      where: { userId: owner, entityId: snapshotPlaceId },
      select: { id: true },
    });
    eventIds.push(...snapshotRows.map((row) => row.id));

    // ---- 10. PII scan over everything this test wrote ----
    const allEvents = await prisma.userEvent.findMany({ where: { id: { in: eventIds } } });
    const allRuns = await prisma.recommendationRun.findMany({ where: { id: { in: runIds } } });
    const haystacks = [
      ...allEvents.map((e) => JSON.stringify(e.meta)),
      ...allRuns.map((r) => JSON.stringify(r.context)),
    ].join("\n");
    assert.equal(
      haystacks.includes(CHILD_NAME),
      false,
      "the child's name must never appear in any UserEvent.meta or RecommendationRun.context written by this test",
    );
    for (const forbidden of ["birthDate", "\"email\"", "\"phone\""]) {
      assert.equal(
        haystacks.includes(forbidden),
        false,
        `forbidden key/marker "${forbidden}" must not appear in any decision/event payload`,
      );
    }

    console.log("decisionAttribution.integration.test.ts: OK");
  } finally {
    await prisma.recommendationOutcome.deleteMany({
      where: { exposure: { runId: { in: runIds } } },
    });
    await prisma.userEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.recommendationExposure.deleteMany({ where: { runId: { in: runIds } } });
    await prisma.recommendationRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.childInterest.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.childCustomInterest.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [...userIds, ...otherUserIds] } } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
