import {
  ExperienceAttendance,
  ExperienceSentiment,
  Prisma,
  type Experience,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSameExperienceFeedback, normalizeExperienceFeedbackComment } from "@/lib/experience/feedback";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";
import { SubjectSchema, type Subject } from "@/lib/decision/decisionContext";
import { findMostRecentSubjectsSnapshot } from "@/lib/decision/subjects";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { getActivityCityIdForAnalytics } from "@/lib/analytics/activityCity";
import { activeFamilyUserIds, activePlanScopeFor, planScopeFor } from "@/server/family/familyAccess";

export class ExperienceDomainError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "not_eligible"
      | "undated_plan_item"
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
  const take = Math.min(3, Math.max(1, input.take ?? 1));
  const [memberIds, scope] = await Promise.all([
    activeFamilyUserIds(input.userId),
    planScopeFor(input.userId),
  ]);
  // Family Core M1a: an Experience is keyed by the adult who recorded it but is
  // visible to every adult who can see its plan item (PRIVATE items stay hidden).
  const candidates = await prisma.experience.findMany({
    where: { userId: { in: memberIds }, entityType: "EVENT", attendance: "ATTENDED", feedbackSentiment: null },
    orderBy: { attendanceConfirmedAt: "desc" },
    take: memberIds.length > 1 ? take * 5 : take,
  });
  if (candidates.length === 0) return [];
  const planItems = await prisma.planItem.findMany({
    where: { id: { in: candidates.map((row) => row.sourcePlanItemId) }, ...scope },
    select: { id: true, title: true, activity: { select: { title: true } } },
  });
  const visibleIds = new Set(planItems.map((item) => item.id));
  const rows = candidates
    .filter((row) => visibleIds.has(row.sourcePlanItemId))
    .slice(0, take);
  if (rows.length === 0) return [];
  const titleByPlanItemId = new Map(
    planItems.map((item) => [item.id, item.activity?.title || item.title || "Событие"]),
  );
  return rows.map((row) => ({
    ...serializeExperience(row),
    title: titleByPlanItemId.get(row.sourcePlanItemId) ?? "Событие",
  }));
}

export type ExperienceVisit = ReturnType<typeof serializeExperience> & {
  title: string;
};

/**
 * История посещений для «Где мы были» в модалке «Мой план»: подтверждённые визиты
 * (ATTENDED), новые сверху. Видимость как у listRecentExperienceSummaries —
 * через семейный scope плана (PRIVATE-пункты скрыты).
 */
export async function listAttendedExperienceVisits(input: {
  userId: string;
  take?: number;
}): Promise<ExperienceVisit[]> {
  const take = Math.min(100, Math.max(1, input.take ?? 60));
  const [memberIds, scope] = await Promise.all([
    activeFamilyUserIds(input.userId),
    planScopeFor(input.userId),
  ]);
  const where = { userId: { in: memberIds }, entityType: "EVENT" as const, attendance: "ATTENDED" as const };
  const orderBy = [{ plannedDate: "desc" as const }, { attendanceConfirmedAt: "desc" as const }];
  // Видимость плана проверяется после выборки, поэтому читаем страницами, пока не наберём `take`
  // видимых визитов (иначе чужие приватные записи вытесняют ваши из лимита).
  const batchSize = memberIds.length > 1 ? take * 2 : take;
  const MAX_BATCHES = 10;
  const visits: ExperienceVisit[] = [];
  for (let batch = 0; batch < MAX_BATCHES && visits.length < take; batch += 1) {
    const rows = await prisma.experience.findMany({
      where,
      orderBy,
      skip: batch * batchSize,
      take: batchSize,
    });
    if (rows.length === 0) break;
    const planItems = await prisma.planItem.findMany({
      where: { id: { in: rows.map((row) => row.sourcePlanItemId) }, ...scope },
      select: { id: true, title: true, activity: { select: { title: true } } },
    });
    const titleByPlanItemId = new Map(
      planItems.map((item) => [item.id, item.activity?.title || item.title || "Событие"]),
    );
    for (const row of rows) {
      if (!titleByPlanItemId.has(row.sourcePlanItemId)) continue;
      visits.push({
        ...serializeExperience(row),
        title: titleByPlanItemId.get(row.sourcePlanItemId) ?? "Событие",
      });
      if (visits.length >= take) break;
    }
    if (rows.length < batchSize) break;
  }
  return visits;
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

  const candidates: PendingExperienceCandidate[] = [];
  const pageSize = 12;
  let cursor: string | undefined;

  // The date range is the hard bound. Page through it until `take` PENDING
  // rows are found; never truncate the raw PlanItem pool before excluding
  // completed occurrences.
  const poolScope = await activePlanScopeFor(input.userId);
  while (candidates.length < take) {
    const pool = await prisma.planItem.findMany({
      where: {
        ...poolScope,
        activityId: { not: null },
        date: { gte: oldestDate, lt: today },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        activityId: true,
        date: true,
        startsAt: true,
        title: true,
        activity: { select: { title: true } },
      },
    });
    if (pool.length === 0) break;
    cursor = pool.at(-1)?.id;

    const existing = await prisma.experience.findMany({
      where: { sourcePlanItemId: { in: pool.map((item) => item.id) } },
      select: { sourcePlanItemId: true },
    });
    const completed = new Set(existing.map((item) => item.sourcePlanItemId));
    for (const item of pool) {
      if (!item.activityId || !item.activity || item.date === null || completed.has(item.id)) continue;
      candidates.push({
        planItemId: item.id,
        activityId: item.activityId,
        title: item.activity.title || item.title || "Событие",
        plannedDate: item.date,
        plannedStartsAt: item.startsAt,
      });
      if (candidates.length === take) break;
    }
    if (pool.length < pageSize) break;
  }
  return candidates;
}

export async function resolveExperienceOrigin(input: {
  userId: string;
  planItemId: string;
  activityId: string;
}): Promise<{
  decisionId: string;
  exposureId: string;
  anonymousId: string | null;
  sessionId: string | null;
} | null> {
  const events = await prisma.userEvent.findMany({
    where: {
      userId: input.userId,
      eventType: "PLAN_ADD",
      entityType: "EVENT",
      entityId: input.activityId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { decisionId: true, anonymousId: true, sessionId: true, meta: true },
  });

  for (const event of events) {
    const meta = metaRecord(event.meta);
    if (meta?.planItemId !== input.planItemId) continue;
    const exposureId =
      typeof meta.recommendationExposureId === "string"
        ? meta.recommendationExposureId.trim()
        : "";
    if (!exposureId || !event.decisionId) return null;
    // The authenticated PLAN_ADD is canonical historical proof: its
    // decisionId/meta pair was written only after server-side verification.
    // Re-check immutable exposure/entity/run consistency without imposing the
    // current actor on a guest-owned historical RecommendationRun.
    const verified = await prisma.recommendationExposure.findFirst({
      where: {
        id: exposureId,
        runId: event.decisionId,
        entityType: "EVENT",
        entityId: input.activityId,
      },
      select: { id: true, runId: true },
    });
    if (!verified) return null;
    return {
      decisionId: verified.runId,
      exposureId: verified.id,
      anonymousId: event.anonymousId,
      sessionId: event.sessionId,
    };
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
  const origin = experience.sourceExposureId
    ? await resolveExperienceOrigin({
        userId: experience.userId,
        planItemId: experience.sourcePlanItemId,
        activityId: experience.entityId,
      })
    : null;
  const recommendationMeta = experience.sourceExposureId
    ? {
        source: "recommendation" as const,
        recommendationExposureId: experience.sourceExposureId,
      }
    : { source: "plan" as const };
  await trackUserEvent({
    idempotencyKey: `experience:${experience.id}:${eventType.toLowerCase()}`,
    userId: experience.userId,
    sessionId: origin?.sessionId ?? context.sessionId ?? null,
    anonymousId: origin?.anonymousId ?? null,
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
  const scope = await planScopeFor(input.userId);
  if (existing) {
    if (existing.userId !== input.userId) {
      // Another adult recorded it: accessible only if the plan item is visible to us.
      const visible = await prisma.planItem.findFirst({
        where: { id: input.planItemId, ...scope },
        select: { id: true },
      });
      if (!visible) throw new ExperienceDomainError("not_found", "Plan item not found");
    }
    assertSameAttendance(existing, input.attendance);
    if (existing.attendance === "ATTENDED") {
      await ensureExperienceTelemetry(existing, "ATTENDED", input);
    }
    return existing;
  }

  const planItem = await prisma.planItem.findFirst({
    where: { id: input.planItemId, ...scope },
    select: { id: true, userId: true, activityId: true, date: true, startsAt: true },
  });
  if (!planItem) throw new ExperienceDomainError("not_found", "Plan item not found");
  if (!planItem.activityId) {
    throw new ExperienceDomainError("unsupported_entity", "Only event plan items are supported");
  }
  if (planItem.date === null) {
    throw new ExperienceDomainError(
      "undated_plan_item",
      "Undated plan item cannot be confirmed as attended",
    );
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
    if (!concurrent) throw error;
    if (concurrent.userId !== input.userId) {
      const visible = await prisma.planItem.findFirst({
        where: { id: planItem.id, ...scope },
        select: { id: true },
      });
      if (!visible) throw error;
    }
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
  comment?: string | null;
  sessionId?: string | null;
}): Promise<Experience> {
  const comment = normalizeExperienceFeedbackComment(input.comment);
  const found = await prisma.experience.findUnique({ where: { id: input.experienceId } });
  let existing = found && found.userId === input.userId ? found : null;
  if (found && !existing) {
    const visible = await prisma.planItem.findFirst({
      where: { id: found.sourcePlanItemId, ...(await planScopeFor(input.userId)) },
      select: { id: true },
    });
    if (visible) existing = found;
  }
  if (!existing) throw new ExperienceDomainError("not_found", "Experience not found");
  if (existing.attendance !== "ATTENDED") {
    throw new ExperienceDomainError("feedback_not_allowed", "Feedback requires attended experience");
  }
  if (existing.feedbackSentiment && !isSameExperienceFeedback(existing, { sentiment: input.sentiment, comment })) {
    throw new ExperienceDomainError("feedback_conflict", "Feedback has already been submitted");
  }

  let experience = existing;
  if (!existing.feedbackSentiment) {
    const updated = await prisma.experience.updateMany({
      where: { id: existing.id, feedbackSentiment: null },
      data: { feedbackSentiment: input.sentiment, feedbackComment: comment, feedbackAt: new Date() },
    });
    experience = await prisma.experience.findUniqueOrThrow({ where: { id: existing.id } });
    if (updated.count === 0 && !isSameExperienceFeedback(experience, { sentiment: input.sentiment, comment })) {
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
    feedbackComment: experience.feedbackComment,
    feedbackAt: experience.feedbackAt?.toISOString() ?? null,
  };
}
