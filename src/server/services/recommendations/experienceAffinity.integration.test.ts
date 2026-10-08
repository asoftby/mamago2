import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AnalyticsEntityType, Prisma, PrismaClient, RecommendationSurface } from "@prisma/client";
import type { Subject } from "@/lib/decision/decisionContext";
import {
  EXPERIENCE_AFFINITY_HORIZON_DAYS,
  EXPERIENCE_AFFINITY_MAX_EVENTS,
  resolveSelectedExperienceAffinity,
  scoreCandidateExperienceAffinity,
} from "./experienceAffinity";
import {
  PLAN_SUGGESTION_ALGORITHM_VERSION,
  planSuggestionScore,
} from "@/server/services/planSuggestions.service";
import { recordRecommendationRun } from "./RecommendationTraceService";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();
const now = new Date("2026-10-02T12:00:00.000Z");

function meta(subjects: unknown[], sentiment?: string) {
  return {
    subjects,
    ...(sentiment ? { sentiment } : {}),
    categoryIds: ["category-science"],
    signalIds: ["signal-education"],
    format: "OFFLINE",
    interestSlugs: ["science"],
  } as unknown as Prisma.InputJsonValue;
}

async function main() {
  const owner = await prisma.user.create({ data: { email: `phase-d-owner-${marker}@example.invalid` } });
  const stranger = await prisma.user.create({ data: { email: `phase-d-stranger-${marker}@example.invalid` } });
  const childA = await prisma.child.create({ data: { parentId: owner.id } });
  const childB = await prisma.child.create({ data: { parentId: owner.id } });
  const subjectA: Subject = { kind: "child", refId: childA.id, source: "profile" };
  const subjectB: Subject = { kind: "child", refId: childB.id, source: "profile" };
  let runId: string | null = null;
  try {
    await prisma.userEvent.createMany({
      data: [
        { userId: owner.id, eventType: "ATTENDED", entityType: "EVENT", entityId: `event-${marker}`, meta: meta([subjectA]), createdAt: now },
        { userId: owner.id, eventType: "EXPERIENCE_FEEDBACK", entityType: "EVENT", entityId: `event-${marker}`, meta: meta([subjectA], "LIKE"), createdAt: now },
        { userId: owner.id, eventType: "EXPERIENCE_FEEDBACK", entityType: "EVENT", entityId: `old-${marker}`, meta: meta([subjectA], "DISLIKE"), createdAt: new Date(now.getTime() - 366 * 86_400_000) },
        { userId: owner.id, eventType: "ATTENDED", entityType: "EVENT", entityId: `malformed-${marker}`, meta: meta([{ name: `private-${marker}`, birthDate: "2020-01-01" }]), createdAt: now },
        { userId: stranger.id, eventType: "EXPERIENCE_FEEDBACK", entityType: "EVENT", entityId: `foreign-${marker}`, meta: meta([subjectA], "DISLIKE"), createdAt: now },
      ],
    });

    const affinityA = await resolveSelectedExperienceAffinity({ userId: owner.id, subjects: [subjectA], now });
    assert.equal(affinityA.outcomeEventCount, 2);
    assert.equal(affinityA.horizonDays, EXPERIENCE_AFFINITY_HORIZON_DAYS);
    assert.equal(EXPERIENCE_AFFINITY_MAX_EVENTS, 200);
    const semantics = {
      categoryId: "category-science",
      signalIds: ["signal-education"],
      format: "OFFLINE",
      interestSlugs: ["science"],
    };
    assert.equal(scoreCandidateExperienceAffinity(affinityA, semantics).experienceAffinityBoost, 6);
    const affinityB = await resolveSelectedExperienceAffinity({ userId: owner.id, subjects: [subjectB], now });
    assert.equal(scoreCandidateExperienceAffinity(affinityB, semantics).experienceAffinityBoost, 0);
    const noIdentity = await resolveSelectedExperienceAffinity({
      userId: owner.id,
      subjects: [{ kind: "child", refId: null, ageRange: "5-7", source: "manual" }],
      now,
    });
    assert.equal(noIdentity.outcomeEventCount, 0);

    const ranked = planSuggestionScore({
      engagementScore: 0,
      profileInterestSlugs: ["science"],
      scheduleJson: { signals: { interests: ["science"] } },
      categoryId: semantics.categoryId,
      discoverySignalIds: semantics.signalIds,
      format: semantics.format,
      experienceAffinity: affinityA,
    });
    assert.equal(ranked.interestBoost, 4);
    assert.equal(ranked.experienceAffinityBoost, 6);
    assert.deepEqual(ranked.experienceReasonCodes, ["EXPERIENCE_POSITIVE"]);

    const trace = await recordRecommendationRun({
      userId: owner.id,
      surface: RecommendationSurface.MY_PLAN,
      algorithmVersion: PLAN_SUGGESTION_ALGORITHM_VERSION,
      candidateCount: 1,
      decisionContext: {
        intent: "my_plan_suggestions",
        subjects: [subjectA],
        constraints: {
          experienceHistory: {
            value: { outcomeEventCount: affinityA.outcomeEventCount, horizonDays: affinityA.horizonDays },
            source: "derived",
          },
        },
        actor: { kind: "user", id: owner.id },
      },
      items: [{
        entityType: AnalyticsEntityType.EVENT,
        entityId: `candidate-${marker}`,
        position: 1,
        score: ranked.score,
        scoreBreakdown: ranked,
        reasonCodes: ranked.experienceReasonCodes,
      }],
    });
    assert.ok(trace);
    runId = trace.runId;
    const stored = await prisma.recommendationRun.findUniqueOrThrow({ where: { id: trace.runId } });
    assert.equal(stored.algorithmVersion, "engagement-profile-interest-experience-v3");
    const contextJson = JSON.stringify(stored.context);
    assert.match(contextJson, /experienceHistory/);
    assert.doesNotMatch(contextJson, /private-|birthDate|dateOfBirth|email|categoryScores|interestScores/);
    const exposure = await prisma.recommendationExposure.findFirstOrThrow({ where: { runId: trace.runId } });
    const breakdown = exposure.scoreBreakdown as Record<string, unknown>;
    assert.equal(breakdown.experienceAffinityBoost, 6);
    assert.equal(breakdown.experienceMatchedSubjectCount, 1);
  } finally {
    if (runId) await prisma.recommendationRun.delete({ where: { id: runId } });
    await prisma.userEvent.deleteMany({ where: { userId: { in: [owner.id, stranger.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });
    await prisma.$disconnect();
  }
}

main()
  .then(() => console.log("experienceAffinity.integration.test.ts: OK"))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
