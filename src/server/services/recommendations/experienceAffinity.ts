import type { Prisma, UserEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SubjectSchema, type Subject } from "@/lib/decision/decisionContext";
import { canonicalSystemInterestSlugs } from "@/lib/event/eventSystemInterests";

export const EXPERIENCE_AFFINITY_HORIZON_DAYS = 365;
export const EXPERIENCE_AFFINITY_MAX_EVENTS = 200;
export const AFFINITY_KEY_MIN = -12;
export const AFFINITY_KEY_MAX = 12;
export const EXPERIENCE_AFFINITY_MIN = -6;
export const EXPERIENCE_AFFINITY_MAX = 6;

const MAX_SELECTED_SUBJECTS = 20;
const MAX_SEMANTIC_VALUES = 50;
const SEMANTIC_KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FORMATS = new Set(["OFFLINE", "ONLINE", "HYBRID"]);

export type SubjectExperienceAffinity = {
  subjectKey: string;
  categoryScores: Map<string, number>;
  signalScores: Map<string, number>;
  formatScores: Map<string, number>;
  interestScores: Map<string, number>;
  outcomeEventCount: number;
};

export type ExperienceAffinityContext = {
  subjects: SubjectExperienceAffinity[];
  outcomeEventCount: number;
  horizonDays: number;
};

export type CandidateExperienceSemantics = {
  categoryId?: string | null;
  signalIds?: readonly string[];
  format?: string | null;
  interestSlugs?: readonly string[];
};

export type ExperienceAffinityScore = {
  experienceAffinityBoost: number;
  experienceMatchedSubjectCount: number;
};

type OutcomeRow = {
  eventType: UserEventType;
  meta: Prisma.JsonValue | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function record(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boundedSemanticKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item): item is string => typeof item === "string" && SEMANTIC_KEY_RE.test(item),
  ))].slice(0, MAX_SEMANTIC_VALUES);
}

function subjectKey(subject: Subject): string | null {
  return subject.refId ? `${subject.kind}:${subject.refId}` : null;
}

export function experienceOutcomeDelta(
  eventType: UserEventType | string,
  sentiment?: unknown,
): number {
  if (eventType === "ATTENDED") return 2;
  if (eventType !== "EXPERIENCE_FEEDBACK") return 0;
  if (sentiment === "LIKE") return 5;
  if (sentiment === "NEUTRAL") return 0;
  if (sentiment === "DISLIKE") return -7;
  return 0;
}

function bump(map: Map<string, number>, keys: readonly string[], delta: number): void {
  if (delta === 0) return;
  for (const key of keys) {
    map.set(key, clamp((map.get(key) ?? 0) + delta, AFFINITY_KEY_MIN, AFFINITY_KEY_MAX));
  }
}

export function buildSelectedExperienceAffinity(
  selectedSubjects: readonly Subject[],
  events: readonly OutcomeRow[],
): ExperienceAffinityContext {
  const selected = new Map<string, SubjectExperienceAffinity>();
  for (const rawSubject of selectedSubjects.slice(0, MAX_SELECTED_SUBJECTS)) {
    const parsed = SubjectSchema.safeParse(rawSubject);
    if (!parsed.success) continue;
    const key = subjectKey(parsed.data);
    if (!key || selected.has(key)) continue;
    selected.set(key, {
      subjectKey: key,
      categoryScores: new Map(),
      signalScores: new Map(),
      formatScores: new Map(),
      interestScores: new Map(),
      outcomeEventCount: 0,
    });
  }

  let outcomeEventCount = 0;
  for (const event of events.slice(0, EXPERIENCE_AFFINITY_MAX_EVENTS)) {
    const meta = record(event.meta);
    const delta = experienceOutcomeDelta(event.eventType, meta.sentiment);
    if (delta === 0) continue;
    const rawSubjects = Array.isArray(meta.subjects) ? meta.subjects : [];
    const matching = new Set<string>();
    for (const rawSubject of rawSubjects.slice(0, MAX_SELECTED_SUBJECTS)) {
      const parsed = SubjectSchema.safeParse(rawSubject);
      if (!parsed.success) continue;
      const key = subjectKey(parsed.data);
      if (key && selected.has(key)) matching.add(key);
    }
    if (matching.size === 0) continue;

    const categoryIds = boundedSemanticKeys(meta.categoryIds);
    const signalIds = boundedSemanticKeys(meta.signalIds);
    const interestSlugs = canonicalSystemInterestSlugs(meta.interestSlugs);
    const format = typeof meta.format === "string" && FORMATS.has(meta.format)
      ? meta.format
      : null;
    if (categoryIds.length + signalIds.length + interestSlugs.length + (format ? 1 : 0) === 0) {
      continue;
    }

    outcomeEventCount += 1;
    for (const key of matching) {
      const affinity = selected.get(key)!;
      affinity.outcomeEventCount += 1;
      bump(affinity.categoryScores, categoryIds, delta);
      bump(affinity.signalScores, signalIds, delta);
      bump(affinity.interestScores, interestSlugs, delta);
      if (format) bump(affinity.formatScores, [format], delta);
    }
  }
  return {
    subjects: [...selected.values()],
    outcomeEventCount,
    horizonDays: EXPERIENCE_AFFINITY_HORIZON_DAYS,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreCandidateExperienceAffinity(
  context: ExperienceAffinityContext | undefined,
  candidate: CandidateExperienceSemantics,
): ExperienceAffinityScore {
  if (!context || context.subjects.length === 0) {
    return { experienceAffinityBoost: 0, experienceMatchedSubjectCount: 0 };
  }
  const subjectScores: number[] = [];
  for (const subject of context.subjects) {
    const dimensions: number[] = [];
    if (candidate.categoryId && subject.categoryScores.has(candidate.categoryId)) {
      dimensions.push(subject.categoryScores.get(candidate.categoryId)!);
    }
    const interestValues = canonicalSystemInterestSlugs(candidate.interestSlugs)
      .flatMap((key) => subject.interestScores.has(key) ? [subject.interestScores.get(key)!] : []);
    if (interestValues.length > 0) dimensions.push(average(interestValues));
    const signalValues = boundedSemanticKeys(candidate.signalIds)
      .flatMap((key) => subject.signalScores.has(key) ? [subject.signalScores.get(key)!] : []);
    if (signalValues.length > 0) dimensions.push(average(signalValues));
    if (candidate.format && subject.formatScores.has(candidate.format)) {
      dimensions.push(subject.formatScores.get(candidate.format)!);
    }
    if (dimensions.length === 0) continue;
    subjectScores.push(clamp(average(dimensions), EXPERIENCE_AFFINITY_MIN, EXPERIENCE_AFFINITY_MAX));
  }
  return {
    experienceAffinityBoost: subjectScores.length > 0
      ? round(clamp(average(subjectScores), EXPERIENCE_AFFINITY_MIN, EXPERIENCE_AFFINITY_MAX))
      : 0,
    experienceMatchedSubjectCount: subjectScores.length,
  };
}

export async function resolveSelectedExperienceAffinity(input: {
  userId: string;
  subjects: Subject[];
  now?: Date;
}): Promise<ExperienceAffinityContext> {
  const selectedSubjects = input.subjects.filter((subject) => subject.refId).slice(0, MAX_SELECTED_SUBJECTS);
  if (selectedSubjects.length === 0) {
    return { subjects: [], outcomeEventCount: 0, horizonDays: EXPERIENCE_AFFINITY_HORIZON_DAYS };
  }
  const since = new Date((input.now ?? new Date()).getTime() - EXPERIENCE_AFFINITY_HORIZON_DAYS * 86_400_000);
  const events = await prisma.userEvent.findMany({
    where: {
      userId: input.userId,
      eventType: { in: ["ATTENDED", "EXPERIENCE_FEEDBACK"] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: EXPERIENCE_AFFINITY_MAX_EVENTS,
    select: { eventType: true, meta: true },
  });
  return buildSelectedExperienceAffinity(selectedSubjects, events);
}
