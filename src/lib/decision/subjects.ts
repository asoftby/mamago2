import type { AnalyticsEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ageRangeAt } from "@/lib/decision/ageRangeAt";
import {
  SubjectSchema,
  sanitizeCanonicalAgeRanges,
  type Subject,
} from "@/lib/decision/decisionContext";

export type BuildSubjectsSnapshotInput = {
  userId: string;
  /** Mixed User.id (adult) / Child.id (child) values, as sent by the client. */
  personaIds: string[];
  /** Date the decision/action applies to (yyyy-mm-dd or ISO). */
  targetDate: string;
};

/**
 * Resolves persona ids against the caller's OWN User/Child rows only — a
 * client-supplied id for someone else's child is silently dropped, never
 * trusted. Age range is computed server-side; the client never sends a
 * birth date.
 */
export async function buildSubjectsSnapshot(
  input: BuildSubjectsSnapshotInput,
): Promise<Subject[]> {
  const personaIds = [...new Set(input.personaIds.filter((id) => id.trim().length > 0))];
  if (personaIds.length === 0) return [];

  const targetDate = new Date(input.targetDate);
  const subjects: Subject[] = [];

  if (personaIds.includes(input.userId)) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, familyRole: true },
    });
    if (user) {
      subjects.push({
        kind: "adult",
        refId: user.id,
        ...(user.familyRole ? { role: user.familyRole } : {}),
        source: "profile",
      });
    }
  }

  const childIds = personaIds.filter((id) => id !== input.userId);
  if (childIds.length > 0) {
    const children = await prisma.child.findMany({
      where: { id: { in: childIds }, parentId: input.userId },
      select: { id: true, birthDate: true, birthPrecision: true },
    });
    for (const child of children) {
      const ageRange = child.birthDate
        ? ageRangeAt(child.birthDate, targetDate, child.birthPrecision)
        : null;
      subjects.push({
        kind: "child",
        refId: child.id,
        ...(ageRange ? { ageRange } : {}),
        source: "profile",
      });
    }
  }

  return subjects;
}

/**
 * Best-effort recovery of "who this was for" when removing a plan item: the
 * PlanItem itself never stored participants, so we look at the most recent
 * PLAN_ADD / PLAN_AUDIENCE_SNAPSHOT UserEvent that carries the SAME planItemId
 * (a same-date audience re-save writes a snapshot, so the newest matching
 * record always reflects the audience last saved for the current date). Requiring both planItemId AND
 * the current target date to match protects against a stale snapshot from
 * before the item was moved to a different date (a fresh PLAN_ADD for the
 * new date always wins, since it's more recent and still matches). If no
 * event proves currency, returns [] rather than attaching a wrong audience —
 * never fabricate.
 */
export async function findMostRecentSubjectsSnapshot(input: {
  userId: string;
  entityType: AnalyticsEntityType;
  entityId: string;
  planItemId: string;
  currentDate: string;
}): Promise<Subject[]> {
  const events = await prisma.userEvent.findMany({
    where: {
      userId: input.userId,
      eventType: { in: ["PLAN_ADD", "PLAN_AUDIENCE_SNAPSHOT"] },
      entityType: input.entityType,
      entityId: input.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { meta: true },
  });

  for (const event of events) {
    const metaObject =
      event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)
        ? (event.meta as Record<string, unknown>)
        : null;
    if (!metaObject) continue;
    if (metaObject.planItemId !== input.planItemId) continue;
    if (metaObject.dateFrom !== input.currentDate) continue;

    const rawSubjects = metaObject.subjects;
    if (!Array.isArray(rawSubjects)) return [];

    const derived: Subject[] = [];
    for (const raw of rawSubjects) {
      const parsed = SubjectSchema.safeParse({ ...(raw as object), source: "derived" });
      if (parsed.success) derived.push(parsed.data);
    }
    return derived;
  }

  return [];
}

/**
 * Records the CURRENT audience for a PlanItem that already exists (so no new
 * PLAN_ADD happened) whenever the user re-saves it — same date with a new
 * audience, or moved to a new date. Written straight to UserEvent rather than
 * through trackUserEvent on purpose: it is a snapshot, not behavior, so it
 * must not reach the behavior projection, promotion actions or outcome
 * linking, and it has its own event type so no PLAN_ADD-counting query can
 * see it. An empty `subjects` is recorded too — "audience cleared" is a real
 * current state and must beat an older non-empty snapshot.
 */
export async function recordPlanAudienceSnapshot(input: {
  userId: string;
  sessionId?: string | null;
  anonymousId?: string | null;
  entityType: AnalyticsEntityType;
  entityId: string;
  cityId?: string | null;
  planItemId: string;
  date: string;
  subjects: Subject[];
}): Promise<void> {
  try {
    await prisma.userEvent.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId ?? undefined,
        anonymousId: input.anonymousId ?? undefined,
        eventType: "PLAN_AUDIENCE_SNAPSHOT",
        entityType: input.entityType,
        entityId: input.entityId,
        vertical: "CITY",
        cityId: input.cityId ?? undefined,
        meta: {
          planItemId: input.planItemId,
          dateFrom: input.date,
          dateTo: input.date,
          decisionContextVersion: 1,
          ...(input.subjects.length > 0 ? { subjects: input.subjects } : {}),
        },
      },
    });
  } catch (error) {
    console.error("[plan-audience-snapshot] write failed", error instanceof Error ? error.name : typeof error);
  }
}

/**
 * Guest variant: no authorized profile to resolve against, so subjects are
 * built directly from manually-selected age-range strings (e.g. the guest
 * "kidRanges" draft). No PII, no refId.
 */
export function buildManualSubjectsSnapshot(ageRanges: string[]): Subject[] {
  return sanitizeCanonicalAgeRanges(ageRanges).map((range) => ({
    kind: "child" as const,
    refId: null,
    ageRange: range,
    source: "manual" as const,
  }));
}
