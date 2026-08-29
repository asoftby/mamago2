import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { computePlanFingerprint, listConfirmedBookingActivityIds } from "@/server/services/dayScenario.service";
import { resolveScenarioItemTime } from "@/features/my-plan/lib/scenarioProjection";
import { resolveScenarioScheduling } from "@/features/my-plan/lib/scenarioScheduling";
import { formatScenarioPriceLabel } from "@/features/my-plan/lib/scenarioPricing";
import { formatActivityAddressLine } from "@/features/my-plan/lib/formatActivityAddress";
import {
  conflictsForScenarioItems,
  type ScenarioClientItem,
} from "@/features/my-plan/lib/scenarioDraft";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KEY_PATTERN = /^[A-Za-z0-9:_-]{8,200}$/;

type ReplacementIntent = {
  planItemId: string;
  newActivityId: string;
  activitySessionId?: string | null;
};

export type SaveIntent = {
  date: string;
  baseFingerprint: string;
  replacements: ReplacementIntent[];
  removals: string[];
  acceptedConflictKeys: string[];
};

export class ScenarioSaveError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(code);
  }
}

function parseIntent(raw: unknown): SaveIntent {
  if (!raw || typeof raw !== "object") throw new ScenarioSaveError(400, "INVALID_PAYLOAD");
  const body = raw as Record<string, unknown>;
  if (typeof body.date !== "string" || !DATE_PATTERN.test(body.date)) throw new ScenarioSaveError(400, "INVALID_DATE");
  if (typeof body.baseFingerprint !== "string" || body.baseFingerprint.length !== 32) throw new ScenarioSaveError(400, "INVALID_FINGERPRINT");
  if (!Array.isArray(body.replacements) || !Array.isArray(body.removals) || !Array.isArray(body.acceptedConflictKeys)) {
    throw new ScenarioSaveError(400, "INVALID_PAYLOAD");
  }
  const replacements = body.replacements.map((value) => {
    if (!value || typeof value !== "object") throw new ScenarioSaveError(400, "INVALID_REPLACEMENT");
    const item = value as Record<string, unknown>;
    if (typeof item.planItemId !== "string" || typeof item.newActivityId !== "string") throw new ScenarioSaveError(400, "INVALID_REPLACEMENT");
    return {
      planItemId: item.planItemId,
      newActivityId: item.newActivityId,
      activitySessionId: typeof item.activitySessionId === "string" ? item.activitySessionId : null,
    };
  });
  const removals = body.removals.filter((value): value is string => typeof value === "string");
  const acceptedConflictKeys = body.acceptedConflictKeys.filter((value): value is string => typeof value === "string");
  if (new Set([...replacements.map((x) => x.planItemId), ...removals]).size !== replacements.length + removals.length) {
    throw new ScenarioSaveError(422, "DUPLICATE_TARGET");
  }
  return { date: body.date, baseFingerprint: body.baseFingerprint, replacements, removals, acceptedConflictKeys };
}

const activityPlaceSelect = {
  shortAddress: true, formattedAddr: true, customAddress: true,
  city: { select: { name: true } },
  metroAuto: { select: { name: true } }, metroManual: { select: { name: true } },
} satisfies Prisma.PlaceSelect;

const activitySelect = {
  id: true, slug: true, title: true, coverImageUrl: true, schedulingKind: true, scheduleJson: true,
  scheduleMode: true, status: true,
  priceFrom: true, priceTo: true, currency: true, priceText: true,
  place: { select: activityPlaceSelect },
  venue: { select: { addressLine: true, place: { select: activityPlaceSelect } } },
  sessions: { select: { id: true, startsAt: true }, orderBy: { startsAt: "asc" as const } },
} satisfies Prisma.ActivitySelect;

async function loadCanonical(tx: Tx, userId: string, date: string, scenarioId: string) {
  const [items, overrideRows] = await Promise.all([
    tx.planItem.findMany({
      where: { userId, date },
      include: { activity: { select: activitySelect } },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    }),
    tx.dayScenarioItemOverride.findMany({ where: { scenarioId }, select: { planItemId: true, startTimeOverride: true } }),
  ]);
  const overrides = new Map(overrideRows.map((row) => [row.planItemId, row.startTimeOverride]));
  return { items, overrides };
}

function projectItems(
  rows: Awaited<ReturnType<typeof loadCanonical>>["items"],
  overrides: Map<string, Date>,
  bookedActivityIds: Set<string>,
): ScenarioClientItem[] {
  return rows.map((row) => {
    const sessions = row.activity?.sessions.filter((session) => getLocalDateKey(session.startsAt) === row.date) ?? [];
    const timing = resolveScenarioItemTime(
      { startsAt: row.startsAt, activity: row.activity ? { sessions } : null },
      overrides.get(row.id) ?? null,
    );
    const scheduling = resolveScenarioScheduling({ activity: row.activity, timing });
    const matchedSession = sessions.find((session) => session.startsAt.getTime() === scheduling.startsAt?.getTime());
    return {
      planItemId: row.id,
      activityId: row.activityId,
      activitySessionId: matchedSession?.id ?? null,
      title: row.title || row.activity?.title || "Активность",
      coverImageUrl: row.coverImageUrl || row.activity?.coverImageUrl || null,
      href: row.activity?.slug ? `/minsk/events/${row.activity.slug}` : null,
      startsAt: scheduling.startsAt?.toISOString() ?? null,
      endsAt: scheduling.endsAt?.toISOString() ?? null,
      durationMinutes: scheduling.durationMinutes,
      schedulingKind: scheduling.kind,
      canReschedule: scheduling.canReschedule,
      priceLabel: formatScenarioPriceLabel(row.activity),
      addressLabel: row.activity ? formatActivityAddressLine(row.activity) : null,
      isBooked: row.activityId != null && bookedActivityIds.has(row.activityId),
    };
  });
}

function fingerprint(
  loaded: Awaited<ReturnType<typeof loadCanonical>>,
  acceptedConflictKeys: string[],
): string {
  return computePlanFingerprint(loaded.items, loaded.overrides, acceptedConflictKeys);
}

export async function saveScenarioDraftForUser(
  userId: string,
  intent: SaveIntent,
  idempotencyKey: string,
): Promise<Prisma.JsonValue> {
  const requestHash = createHash("sha256").update(JSON.stringify({
    ...intent,
    replacements: [...intent.replacements].sort((a, b) => a.planItemId.localeCompare(b.planItemId)),
    removals: [...intent.removals].sort(),
    acceptedConflictKeys: [...new Set(intent.acceptedConflictKeys)].sort(),
  })).digest("hex");
  return prisma.$transaction(async (tx) => {
    const scenario = await tx.dayScenario.findUnique({ where: { userId_date: { userId, date: intent.date } } });
    if (!scenario) throw new ScenarioSaveError(404, "SCENARIO_NOT_FOUND");
    await tx.$queryRaw`SELECT id FROM "DayScenario" WHERE id = ${scenario.id} FOR UPDATE`;
    const locked = await tx.dayScenario.findUniqueOrThrow({ where: { id: scenario.id } });

    if (locked.lastSaveIdempotencyKey === idempotencyKey) {
      if (locked.lastSaveRequestHash !== requestHash || !locked.lastSaveResponse) {
        throw new ScenarioSaveError(409, "IDEMPOTENCY_KEY_REUSED");
      }
      return locked.lastSaveResponse;
    }

    const current = await loadCanonical(tx as Tx, userId, intent.date, scenario.id);
    if (fingerprint(current, locked.acceptedConflictKeys) !== intent.baseFingerprint) {
      throw new ScenarioSaveError(409, "PLAN_CHANGED");
    }
    const targets = new Map(current.items.map((item) => [item.id, item]));
    if ([...intent.replacements.map((x) => x.planItemId), ...intent.removals].some((id) => !targets.has(id))) {
      throw new ScenarioSaveError(422, "INVALID_PLAN_ITEM");
    }

    for (const replacement of intent.replacements) {
      const activity = await tx.activity.findUnique({ where: { id: replacement.newActivityId }, select: activitySelect });
      if (!activity || activity.status !== "PUBLISHED") throw new ScenarioSaveError(422, "INVALID_REPLACEMENT", replacement.newActivityId);
      const duplicate = await tx.planItem.findFirst({
        where: { userId, activityId: activity.id, id: { not: replacement.planItemId } },
        select: { id: true },
      });
      if (duplicate) throw new ScenarioSaveError(422, "DUPLICATE_ACTIVITY", activity.id);

      let startsAt: Date | null = null;
      if (replacement.activitySessionId) {
        const session = activity.sessions.find((row) => row.id === replacement.activitySessionId);
        if (!session || getLocalDateKey(session.startsAt) !== intent.date) throw new ScenarioSaveError(422, "INVALID_OCCURRENCE", activity.id);
        startsAt = session.startsAt;
      } else if (!(["ALWAYS", "ON_DEMAND", "RECURRING"] as string[]).includes(activity.scheduleMode)) {
        throw new ScenarioSaveError(422, "OCCURRENCE_REQUIRED", activity.id);
      }

      await tx.planItem.update({
        where: { id: replacement.planItemId },
        data: { activityId: activity.id, startsAt, title: activity.title, coverImageUrl: activity.coverImageUrl },
      });
      await tx.dayScenarioItemOverride.deleteMany({ where: { scenarioId: scenario.id, planItemId: replacement.planItemId } });
    }

    if (intent.removals.length > 0) {
      await tx.dayScenarioItemOverride.deleteMany({ where: { scenarioId: scenario.id, planItemId: { in: intent.removals } } });
      await tx.planItem.deleteMany({ where: { userId, date: intent.date, id: { in: intent.removals } } });
    }

    const finalLoaded = await loadCanonical(tx as Tx, userId, intent.date, scenario.id);
    const finalActivityIds = finalLoaded.items
      .map((item) => item.activityId)
      .filter((id): id is string => id != null);
    const bookedActivityIds = await listConfirmedBookingActivityIds(userId, finalActivityIds);
    const projected = projectItems(finalLoaded.items, finalLoaded.overrides, bookedActivityIds);
    const conflicts = conflictsForScenarioItems(projected);
    const validKeys = new Set(conflicts.map((conflict) => conflict.key));
    const acceptedConflictKeys = [...new Set(intent.acceptedConflictKeys)].filter((key) => validKeys.has(key)).sort();
    const newFingerprint = fingerprint(finalLoaded, acceptedConflictKeys);
    const canonical = { items: projected, conflicts, acceptedConflictKeys, fingerprint: newFingerprint };

    await tx.dayScenario.update({
      where: { id: scenario.id },
      data: {
        acceptedConflictKeys,
        planFingerprint: newFingerprint,
        lastSaveIdempotencyKey: idempotencyKey,
        lastSaveRequestHash: requestHash,
        lastSaveResponse: canonical as unknown as Prisma.InputJsonValue,
      },
    });
    return canonical as unknown as Prisma.JsonValue;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
  if (!KEY_PATTERN.test(idempotencyKey)) return NextResponse.json({ code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });

  try {
    const intent = parseIntent(await request.json());
    const response = await saveScenarioDraftForUser(user.id, intent, idempotencyKey);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ScenarioSaveError) {
      return NextResponse.json({ code: error.code, details: error.details }, { status: error.status });
    }
    console.error("Scenario save failed", error);
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
