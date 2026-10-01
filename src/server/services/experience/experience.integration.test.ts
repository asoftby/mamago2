import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, RecommendationSurface } from "@prisma/client";
import {
  confirmPlanExperience,
  ExperienceDomainError,
  listPendingExperienceCandidates,
  submitExperienceFeedback,
} from "./experience.service";
import { recordPlanAudienceSnapshot } from "@/lib/decision/subjects";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { recordRecommendationRun } from "@/server/services/recommendations/RecommendationTraceService";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

async function expectDomainCode(promise: Promise<unknown>, code: ExperienceDomainError["code"]) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ExperienceDomainError);
    assert.equal(error.code, code);
    return true;
  });
}

async function waitForOutcome(userEventId: string) {
  for (let index = 0; index < 20; index += 1) {
    const row = await prisma.recommendationOutcome.findUnique({ where: { userEventId } });
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return null;
}

async function main() {
  const owner = await prisma.user.create({
    data: { email: `experience-owner-${marker}@example.invalid`, familyRole: "MOM" },
  });
  const stranger = await prisma.user.create({
    data: { email: `experience-stranger-${marker}@example.invalid` },
  });
  const childA = await prisma.child.create({
    data: {
      parentId: owner.id,
      name: `private-child-a-${marker}`,
      birthDate: new Date("2020-06-15T00:00:00.000Z"),
      birthPrecision: "DAY",
    },
  });
  const childB = await prisma.child.create({
    data: {
      parentId: owner.id,
      name: `private-child-b-${marker}`,
      birthDate: new Date("2021-07-10T00:00:00.000Z"),
      birthPrecision: "DAY",
    },
  });
  const activity = await prisma.activity.create({
    data: {
      ownerUserId: owner.id,
      title: `Phase C event ${marker}`,
      shortDesc: "fixture",
      type: "EVENT",
      scheduleMode: "ONE_TIME",
      ageTags: [],
    },
  });

  try {
    const past = await prisma.planItem.create({
      data: { userId: owner.id, activityId: activity.id, date: "2026-09-29" },
    });
    const today = await prisma.planItem.create({
      data: { userId: owner.id, activityId: activity.id, date: "2026-10-01" },
    });
    const future = await prisma.planItem.create({
      data: { userId: owner.id, activityId: activity.id, date: "2026-10-02" },
    });
    const place = await prisma.planItem.create({
      data: { userId: owner.id, date: "2026-09-30", planPlaceSlug: `place-${marker}` },
    });
    const foreign = await prisma.planItem.create({
      data: { userId: stranger.id, activityId: activity.id, date: "2026-09-29" },
    });

    const candidates = await listPendingExperienceCandidates({
      userId: owner.id,
      today: "2026-10-01",
      lookbackDays: 7,
      take: 3,
    });
    assert.deepEqual(candidates.map((candidate) => candidate.planItemId), [past.id]);
    assert.equal(candidates.some((candidate) => candidate.planItemId === today.id), false);
    assert.equal(candidates.some((candidate) => candidate.planItemId === future.id), false);
    assert.equal(candidates.some((candidate) => candidate.planItemId === place.id), false);

    const trace = await recordRecommendationRun({
      userId: owner.id,
      surface: RecommendationSurface.MY_PLAN,
      targetDateFrom: past.date,
      targetDateTo: past.date,
      algorithmVersion: "phase-c-fixture-v1",
      candidateCount: 1,
      decisionContext: {
        intent: "my_plan_suggestions",
        subjects: [{ kind: "child", refId: childA.id, ageRange: "5-7", source: "profile" }],
        actor: { kind: "user", id: owner.id },
      },
      items: [{ entityType: "EVENT", entityId: activity.id, position: 1 }],
    });
    assert.ok(trace);
    const exposureId = trace.exposureIdByEntityKey.get(`EVENT:${activity.id}`);
    assert.ok(exposureId);

    const planAddResult = await trackUserEvent({
      userId: owner.id,
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: activity.id,
      meta: {
        source: "recommendation",
        recommendationExposureId: exposureId,
        planItemId: past.id,
        dateFrom: past.date,
        dateTo: past.date,
        decisionContextVersion: 1,
        subjects: [{ kind: "child", refId: childA.id, ageRange: "5-7", source: "profile" }],
      },
    });
    assert.equal(planAddResult.ok, true);
    await recordPlanAudienceSnapshot({
      userId: owner.id,
      entityType: "EVENT",
      entityId: activity.id,
      planItemId: past.id,
      date: past.date,
      subjects: [{ kind: "child", refId: childB.id, ageRange: "5-7", source: "profile" }],
    });

    await expectDomainCode(
      confirmPlanExperience({
        userId: owner.id,
        planItemId: today.id,
        attendance: "ATTENDED",
        today: "2026-10-01",
      }),
      "not_eligible",
    );
    await expectDomainCode(
      confirmPlanExperience({
        userId: owner.id,
        planItemId: future.id,
        attendance: "ATTENDED",
        today: "2026-10-01",
      }),
      "not_eligible",
    );
    await expectDomainCode(
      confirmPlanExperience({
        userId: owner.id,
        planItemId: place.id,
        attendance: "ATTENDED",
        today: "2026-10-01",
      }),
      "unsupported_entity",
    );
    await expectDomainCode(
      confirmPlanExperience({
        userId: owner.id,
        planItemId: foreign.id,
        attendance: "ATTENDED",
        today: "2026-10-01",
      }),
      "not_found",
    );

    const attended = await confirmPlanExperience({
      userId: owner.id,
      planItemId: past.id,
      attendance: "ATTENDED",
      today: "2026-10-01",
    });
    assert.equal(attended.attendance, "ATTENDED");
    assert.equal(attended.sourceDecisionId, trace.runId);
    assert.equal(attended.sourceExposureId, exposureId);
    const subjectsJson = JSON.stringify(attended.subjects);
    assert.match(subjectsJson, new RegExp(childB.id));
    assert.doesNotMatch(subjectsJson, new RegExp(childA.id));
    assert.doesNotMatch(subjectsJson, /private-child|birthDate|dateOfBirth|dob/i);

    const retry = await confirmPlanExperience({
      userId: owner.id,
      planItemId: past.id,
      attendance: "ATTENDED",
      today: "2026-10-01",
    });
    assert.equal(retry.id, attended.id);
    assert.equal(
      await prisma.experience.count({ where: { sourcePlanItemId: past.id } }),
      1,
    );
    const attendedEvents = await prisma.userEvent.findMany({
      where: { userId: owner.id, eventType: "ATTENDED", entityId: activity.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const matchingAttended = attendedEvents.filter(
      (event) => (event.meta as Record<string, unknown> | null)?.experienceId === attended.id,
    );
    assert.equal(matchingAttended.length, 1);
    assert.equal(matchingAttended[0]?.decisionId, trace.runId);
    assert.equal(
      (matchingAttended[0]?.meta as Record<string, unknown>).recommendationExposureId,
      exposureId,
    );
    const outcome = await waitForOutcome(matchingAttended[0]!.id);
    assert.equal(outcome?.exposureId, exposureId);
    assert.equal(outcome?.eventType, "ATTENDED");

    await expectDomainCode(
      confirmPlanExperience({
        userId: owner.id,
        planItemId: past.id,
        attendance: "NOT_ATTENDED",
        today: "2026-10-01",
      }),
      "attendance_conflict",
    );

    const feedback = await submitExperienceFeedback({
      userId: owner.id,
      experienceId: attended.id,
      sentiment: "LIKE",
    });
    assert.equal(feedback.feedbackSentiment, "LIKE");
    const feedbackRetry = await submitExperienceFeedback({
      userId: owner.id,
      experienceId: attended.id,
      sentiment: "LIKE",
    });
    assert.equal(feedbackRetry.feedbackSentiment, "LIKE");
    await expectDomainCode(
      submitExperienceFeedback({
        userId: owner.id,
        experienceId: attended.id,
        sentiment: "NEUTRAL",
      }),
      "feedback_conflict",
    );
    const feedbackEvents = await prisma.userEvent.findMany({
      where: { userId: owner.id, eventType: "EXPERIENCE_FEEDBACK", entityId: activity.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const matchingFeedback = feedbackEvents.filter(
      (event) => (event.meta as Record<string, unknown> | null)?.experienceId === attended.id,
    );
    assert.equal(matchingFeedback.length, 1);
    assert.equal((matchingFeedback[0]?.meta as Record<string, unknown>).sentiment, "LIKE");
    assert.equal(matchingFeedback[0]?.decisionId, trace.runId);

    const missedPlan = await prisma.planItem.create({
      data: { userId: owner.id, activityId: activity.id, date: "2026-09-28" },
    });
    const missed = await confirmPlanExperience({
      userId: owner.id,
      planItemId: missedPlan.id,
      attendance: "NOT_ATTENDED",
      today: "2026-10-01",
    });
    assert.equal(missed.attendance, "NOT_ATTENDED");
    assert.equal(
      await prisma.userEvent.count({
        where: {
          userId: owner.id,
          eventType: "ATTENDED",
          entityId: activity.id,
          createdAt: { gte: missed.createdAt },
        },
      }),
      0,
    );
    await expectDomainCode(
      submitExperienceFeedback({ userId: owner.id, experienceId: missed.id, sentiment: "DISLIKE" }),
      "feedback_not_allowed",
    );

    for (const [index, sentiment] of (["NEUTRAL", "DISLIKE"] as const).entries()) {
      const feedbackPlan = await prisma.planItem.create({
        data: {
          userId: owner.id,
          activityId: activity.id,
          date: index === 0 ? "2026-09-27" : "2026-09-26",
        },
      });
      const feedbackExperience = await confirmPlanExperience({
        userId: owner.id,
        planItemId: feedbackPlan.id,
        attendance: "ATTENDED",
        today: "2026-10-01",
      });
      const saved = await submitExperienceFeedback({
        userId: owner.id,
        experienceId: feedbackExperience.id,
        sentiment,
      });
      assert.equal(saved.feedbackSentiment, sentiment);
    }

    const concurrentPlan = await prisma.planItem.create({
      data: { userId: owner.id, activityId: activity.id, date: "2026-09-25" },
    });
    const concurrent = await Promise.all([
      confirmPlanExperience({
        userId: owner.id,
        planItemId: concurrentPlan.id,
        attendance: "ATTENDED",
        today: "2026-10-01",
      }),
      confirmPlanExperience({
        userId: owner.id,
        planItemId: concurrentPlan.id,
        attendance: "ATTENDED",
        today: "2026-10-01",
      }),
    ]);
    assert.equal(concurrent[0].id, concurrent[1].id);
    assert.equal(
      await prisma.experience.count({ where: { sourcePlanItemId: concurrentPlan.id } }),
      1,
    );
    const concurrentFeedback = await Promise.all([
      submitExperienceFeedback({
        userId: owner.id,
        experienceId: concurrent[0].id,
        sentiment: "NEUTRAL",
      }),
      submitExperienceFeedback({
        userId: owner.id,
        experienceId: concurrent[0].id,
        sentiment: "NEUTRAL",
      }),
    ]);
    assert.equal(concurrentFeedback[0].feedbackSentiment, "NEUTRAL");
    assert.equal(concurrentFeedback[1].feedbackSentiment, "NEUTRAL");

    const behaviorProfile = await prisma.userBehaviorProfile.findUniqueOrThrow({
      where: { userId: owner.id },
    });
    assert.equal(behaviorProfile.totalPlanAdds, 1);
    assert.equal(
      (behaviorProfile.preferredVerticals as Record<string, number> | null)?.CITY,
      undefined,
      "ATTENDED and feedback are intentionally ignored by ranking projection",
    );

    await prisma.planItem.delete({ where: { id: past.id } });
    assert.equal(await prisma.experience.count({ where: { id: attended.id } }), 1);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });
    await prisma.$disconnect();
  }
}

main()
  .then(() => console.log("experience.integration.test.ts: OK"))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
