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
import { buildSubjectsSnapshot, findMostRecentSubjectsSnapshot } from "@/lib/decision/subjects";

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
      algorithmVersion: "test-v1",
      candidateCount: 2,
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

    // ---- authenticated run, for attribution tests ----
    const authedRun = await recordRecommendationRun({
      userId: owner,
      surface: RecommendationSurface.MY_PLAN,
      citySlug: "minsk",
      algorithmVersion: "test-v1",
      candidateCount: 1,
      items: [{ entityType: AnalyticsEntityType.EVENT, entityId: activityIdA, position: 1 }],
    });
    assert.ok(authedRun);
    runIds.push(authedRun!.runId);
    const ownerExposureId = authedRun!.exposureIdByEntityKey.get(`EVENT:${activityIdA}`)!;
    assert.ok(ownerExposureId);

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

    // ---- 8. findMostRecentSubjectsSnapshot (PLAN_REMOVE derivation) ----
    const planAddWithSubjects = await trackUserEvent({
      userId: owner,
      eventType: "PLAN_ADD",
      entityType: "PLACE",
      entityId: `place-${marker}`,
      meta: {
        subjects: [{ kind: "child", refId: child.id, ageRange: "3-5", source: "profile" }],
        decisionContextVersion: 1,
      },
    });
    assert.equal(planAddWithSubjects.ok, true);
    const savedPlanAdd = await prisma.userEvent.findFirst({
      where: { userId: owner, eventType: "PLAN_ADD", entityType: "PLACE", entityId: `place-${marker}` },
      orderBy: { createdAt: "desc" },
    });
    eventIds.push(savedPlanAdd!.id);

    const derived = await findMostRecentSubjectsSnapshot({
      userId: owner,
      entityType: AnalyticsEntityType.PLACE,
      entityId: `place-${marker}`,
    });
    assert.equal(derived.length, 1);
    assert.equal(derived[0]!.source, "derived", "recovered snapshot is re-tagged as derived, not profile");
    assert.equal(derived[0]!.refId, child.id);

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
