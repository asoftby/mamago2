import {
  ExperienceAttendance,
  ExperienceSentiment,
  Prisma,
  type Experience,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";
import { SubjectSchema, type Subject } from "@/lib/decision/decisionContext";
import { findMostRecentSubjectsSnapshot } from "@/lib/decision/subjects";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { verifyRecommendationAttribution } from "@/server/services/recommendations/RecommendationTraceService";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";

export class ExperienceDomainError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "not_eligible"
      | "unsupported_entity"
      | "attendance_conflict"
      | "feedback_not_allowed"
      | "feedback_conflict",
    message: string,
  ) {
    super(message);
    this.name = "ExperienceDomainError";
  }
}

export type PendingExperienceCandidate = {
  planItemId: string;
  activityId: string;
  title: string;
  plannedDate: string;
  plannedStartsAt: Date | null;
};

export type ExperienceSummary = ReturnType<typeof serializeExperience> & {
  title: string;
};

export async function listRecentExperienceSummaries(input: {
  userId: string;
  take?: number;
}): Promise<ExperienceSummary[]> {
  const rows = await prisma.experience.findMany({
    where: { userId: input.userId, entityType: "EVENT" },
    orderBy: { attendanceConfirmedAt: "desc" },
    take: Math.min(3, Math.max(1, input.take ?? 1)),
  });
  if (rows.length === 0) return [];
  const planItems = await prisma.planItem.findMany({
    where: { id: { in: rows.map((row) => row.sourcePlanItemId) }, userId: input.userId },
    select: { id: true, title: true, activity: { select: { title: true } } },
  });
  const titleByPlanItemId = new Map(
    planItems.map((item) => [item.id, item.activity?.title || item.title || "Событие"]),
  );
  return rows.map((row) => ({
    ...serializeExperience(row),
    title: titleByPlanItemId.get(row.sourcePlanItemId) ?? "Событие",
  }));
}

type TelemetryContext = {
  sessionId?: string | null;
};

function safeSubjects(value: Prisma.JsonValue | null): Subject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const parsed = SubjectSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

function metaRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function listPendingExperienceCandidates(input: {
  userId: string;
  today?: string;
  lookbackDays?: number;
  take?: number;
}): Promise<PendingExperienceCandidate[]> {
  const today = input.today ?? getLocalDateKey();
  const lookbackDays = Math.min(30, Math.max(1, input.lookbackDays ?? 14));
  const take = Math.min(3, Math.max(1, input.take ?? 3));
  const oldestDate = addDaysLocal(today, -lookbackDays);

  const pool = await prisma.planItem.findMany({
    where: {
      userId: input.userId,
      activityId: { not: null },
      date: { gte: oldestDate, lt: today },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: Math.max(take * 4, 12),
    select: {
      id: true,
      activityId: true,
      date: true,
      startsAt: true,
      title: true,
      activity: { select: { title: true } },
    },
  });
  if (pool.length === 0) return [];

  const existing = await prisma.experience.findMany({
    where: { sourcePlanItemId: { in: pool.map((item) => item.id) } },
    select: { sourcePlanItemId: true },
  });
  const completed = new Set(existing.map((item) => item.sourcePlanItemId));

  return pool
    .filter(
      (item): item is typeof item & { activityId: string; activity: { title: string } } =>
        Boolean(item.activityId && item.activity && !completed.has(item.id)),
    )
    .slice(0, take)
    .map((item) => ({
      planItemId: item.id,
      activityId: item.activityId,
      title: item.activity.title || item.title || "Событие",
      plannedDate: item.date,
      plannedStartsAt: item.startsAt,
    }));
}

export async function resolveExperienceOrigin(input: {
  userId: string;
  planItemId: string;
  activityId: string;
}): Promise<{ decisionId: string; exposureId: string } | null> {
  const events = await prisma.userEvent.findMany({
    where: {
      userId: input.userId,
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: input.activityId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { decisionId: true, meta: true },
  });

  for (const event of events) {
    const meta = metaRecord(event.meta);
    if (meta?.planItemId !== input.planItemId) continue;
    const exposureId =
      typeof meta.recommendationExposureId === "string"
        ? meta.recommendationExposureId.trim()
        : "";
    if (!exposureId) return null;
    const verified = await verifyRecommendationAttribution({
      exposureId,
      entityType: "EVENT",
      entityId: input.activityId,
      userId: input.userId,
    });
    if (!verified || (event.decisionId && event.decisionId !== verified.runId)) return null;
    return { decisionId: verified.runId, exposureId: verified.exposureId };
  }
  return null;
}

async function hasExperienceEvent(input: {
  userId: string;
  experienceId: string;
  entityId: string;
  eventType: "ATTENDED" | "EXPERIENCE_FEEDBACK";
}): Promise<boolean> {
  const events = await prisma.userEvent.findMany({
    where: {
      userId: input.userId,
      eventType: input.eventType,
      entityType: "EVENT",
      entityId: input.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { meta: true },
  });
  return events.some((event) => metaRecord(event.meta)?.experienceId === input.experienceId);
}

async function ensureExperienceTelemetry(
  experience: Experience,
  eventType: "ATTENDED" | "EXPERIENCE_FEEDBACK",
  context: TelemetryContext,
): Promise<void> {
  if (
    await hasExperienceEvent({
      userId: experience.userId,
      experienceId: experience.id,
      entityId: experience.entityId,
      eventType,
    })
  ) {
    return;
  }

  const subjects = safeSubjects(experience.subjects);
  const recommendationMeta = experience.sourceExposureId
    ? {
        source: "recommendation" as const,
        recommendationExposureId: experience.sourceExposureId,
      }
    : { source: "plan" as const };
  await trackUserEvent({
    userId: experience.userId,
    sessionId: context.sessionId ?? null,
    eventType,
    entityType: "EVENT",
    entityId: experience.entityId,
    vertical: "CITY",
    cityId: await getActivityCityIdForAnalytics(experience.entityId),
    meta: {
      ...recommendationMeta,
      experienceId: experience.id,
      planItemId: experience.sourcePlanItemId,
      plannedDate: experience.plannedDate,
      experienceSource: "plan_check_in",
      subjects,
      decisionContextVersion: 1,
      ...(eventType === "EXPERIENCE_FEEDBACK"
        ? { sentiment: experience.feedbackSentiment }
        : {}),
    },
  });
}

function assertSameAttendance(
  existing: Experience,
  attendance: ExperienceAttendance,
): Experience {
  if (existing.attendance !== attendance) {
    throw new ExperienceDomainError(
      "attendance_conflict",
      "Attendance has already been confirmed and cannot be changed",
    );
  }
  return existing;
}

export async function confirmPlanExperience(input: {
  userId: string;
  planItemId: string;
  attendance: ExperienceAttendance;
  today?: string;
  sessionId?: string | null;
}): Promise<Experience> {
  const today = input.today ?? getLocalDateKey();
  const existing = await prisma.experience.findUnique({
    where: { sourcePlanItemId: input.planItemId },
  });
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new ExperienceDomainError("not_found", "Plan item not found");
    }
    assertSameAttendance(existing, input.attendance);
    if (existing.attendance === "ATTENDED") {
      await ensureExperienceTelemetry(existing, "ATTENDED", input);
    }
    return existing;
  }

  const planItem = await prisma.planItem.findFirst({
    where: { id: input.planItemId, userId: input.userId },
    select: { id: true, userId: true, activityId: true, date: true, startsAt: true },
  });
  if (!planItem) throw new ExperienceDomainError("not_found", "Plan item not found");
  if (!planItem.activityId) {
    throw new ExperienceDomainError("unsupported_entity", "Only event plan items are supported");
  }
  if (planItem.date >= today) {
    throw new ExperienceDomainError("not_eligible", "Event is not eligible for check-in yet");
  }

  const [subjects, origin] = await Promise.all([
    findMostRecentSubjectsSnapshot({
      userId: input.userId,
      entityType: "EVENT",
      entityId: planItem.activityId,
      planItemId: planItem.id,
      currentDate: planItem.date,
    }),
    resolveExperienceOrigin({
      userId: input.userId,
      planItemId: planItem.id,
      activityId: planItem.activityId,
    }),
  ]);

  let experience: Experience;
  try {
    experience = await prisma.experience.create({
      data: {
        userId: input.userId,
        sourcePlanItemId: planItem.id,
        entityType: "EVENT",
        entityId: planItem.activityId,
        plannedDate: planItem.date,
        plannedStartsAt: planItem.startsAt,
        attendance: input.attendance,
        attendanceConfirmedAt: new Date(),
        subjects: subjects.length > 0 ? subjects : Prisma.JsonNull,
        sourceDecisionId: origin?.decisionId ?? null,
        sourceExposureId: origin?.exposureId ?? null,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const concurrent = await prisma.experience.findUnique({
      where: { sourcePlanItemId: planItem.id },
    });
    if (!concurrent || concurrent.userId !== input.userId) throw error;
    experience = assertSameAttendance(concurrent, input.attendance);
  }

  if (experience.attendance === "ATTENDED") {
    await ensureExperienceTelemetry(experience, "ATTENDED", input);
  }
  return experience;
}

export async function submitExperienceFeedback(input: {
  userId: string;
  experienceId: string;
  sentiment: ExperienceSentiment;
  sessionId?: string | null;
}): Promise<Experience> {
  const existing = await prisma.experience.findFirst({
    where: { id: input.experienceId, userId: input.userId },
  });
  if (!existing) throw new ExperienceDomainError("not_found", "Experience not found");
  if (existing.attendance !== "ATTENDED") {
    throw new ExperienceDomainError("feedback_not_allowed", "Feedback requires attended experience");
  }
  if (existing.feedbackSentiment && existing.feedbackSentiment !== input.sentiment) {
    throw new ExperienceDomainError("feedback_conflict", "Feedback has already been submitted");
  }

  let experience = existing;
  if (!existing.feedbackSentiment) {
    const updated = await prisma.experience.updateMany({
      where: { id: existing.id, userId: input.userId, feedbackSentiment: null },
      data: { feedbackSentiment: input.sentiment, feedbackAt: new Date() },
    });
    experience = await prisma.experience.findUniqueOrThrow({ where: { id: existing.id } });
    if (updated.count === 0 && experience.feedbackSentiment !== input.sentiment) {
      throw new ExperienceDomainError("feedback_conflict", "Feedback has already been submitted");
    }
  }
  await ensureExperienceTelemetry(experience, "EXPERIENCE_FEEDBACK", input);
  return experience;
}

export function serializeExperience(experience: Experience) {
  return {
    id: experience.id,
    planItemId: experience.sourcePlanItemId,
    entityType: experience.entityType,
    entityId: experience.entityId,
    plannedDate: experience.plannedDate,
    plannedStartsAt: experience.plannedStartsAt?.toISOString() ?? null,
    attendance: experience.attendance,
    attendanceConfirmedAt: experience.attendanceConfirmedAt.toISOString(),
    feedbackSentiment: experience.feedbackSentiment,
    feedbackAt: experience.feedbackAt?.toISOString() ?? null,
  };
}
