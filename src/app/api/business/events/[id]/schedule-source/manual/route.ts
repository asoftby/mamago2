import { NextRequest, NextResponse } from "next/server";
import { ActivityType, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import prisma from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";
import { acquireActivityScheduleLock } from "@/server/modules/import/services/activity-schedule-lock";

export const runtime = "nodejs";

type ManualScheduleItem = {
  id: string;
  isMultiDay: false;
  date: string;
  dateEnd: null;
  allDay: false;
  startTime: string;
  endTime: string;
  recurringEnabled: false;
  recurrenceInterval: 1;
  recurrenceUnit: "week";
  recurrenceUntil: null;
  isCollapsed: false;
};

type TakeoverResult =
  | { kind: "ok"; scheduleItems: ManualScheduleItem[] }
  | { kind: "not-found" }
  | { kind: "no-imported-sessions" }
  | { kind: "duplicate-starts"; duplicateStartsAt: string[] };

function readDurationMinutes(scheduleJson: unknown): number | null {
  if (!scheduleJson || typeof scheduleJson !== "object" || Array.isArray(scheduleJson)) return null;
  const value = (scheduleJson as Record<string, unknown>).durationMinutes;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 600
    ? value
    : null;
}

function endTimeFromDuration(startTime: string, durationMinutes: number | null): string {
  if (durationMinutes == null) return "";
  const [hoursRaw, minutesRaw] = startTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";

  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;
  if (endMinutes >= 24 * 60) return "";

  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;
}

function buildManualScheduleItems(
  sessions: Array<{ id: string; startsAt: Date }>,
  durationMinutes: number | null,
): ManualScheduleItem[] {
  return sessions.map((session) => {
    const startTime = formatHHMM(session.startsAt);
    return {
      id: `manual-import-${session.id}`,
      isMultiDay: false,
      date: getLocalDateKey(session.startsAt),
      dateEnd: null,
      allDay: false,
      startTime,
      endTime: endTimeFromDuration(startTime, durationMinutes),
      recurringEnabled: false,
      recurrenceInterval: 1,
      recurrenceUnit: "week",
      recurrenceUntil: null,
      isCollapsed: false,
    };
  });
}

function findDuplicateStartsAt(sessions: Array<{ startsAt: Date }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const session of sessions) {
    const key = session.startsAt.toISOString();
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }

  return [...duplicates].sort();
}

/**
 * POST /api/business/events/[id]/schedule-source/manual
 *
 * Explicitly hands an imported event's schedule over to the wizard/editor.
 * Import writes and takeover use the same advisory lock, so ownership cannot
 * be split by a concurrent import apply.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id: activityId } = await params;
  if (!(await canManageActivityById(user, activityId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const takeover = await prisma.$transaction(async (tx): Promise<TakeoverResult> => {
    await acquireActivityScheduleLock(tx, activityId);

    const activity = await tx.activity.findFirst({
      where: { id: activityId, type: ActivityType.EVENT },
      select: { id: true, scheduleJson: true },
    });
    if (!activity) return { kind: "not-found" };

    const importedSessions = await tx.activitySession.findMany({
      where: { activityId, source: { not: null } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: { id: true, startsAt: true },
    });

    if (importedSessions.length === 0) {
      return { kind: "no-imported-sessions" };
    }

    const duplicateStartsAt = findDuplicateStartsAt(importedSessions);
    if (duplicateStartsAt.length > 0) {
      // EventScheduleList/materialization currently cannot preserve two
      // distinct imported performances that occupy the exact same instant.
      // Refuse takeover rather than silently collapsing one ticket identity.
      return { kind: "duplicate-starts", duplicateStartsAt };
    }

    const currentSchedule =
      activity.scheduleJson && typeof activity.scheduleJson === "object" && !Array.isArray(activity.scheduleJson)
        ? (activity.scheduleJson as Record<string, unknown>)
        : {};
    const durationMinutes = readDurationMinutes(currentSchedule);
    const scheduleItems = buildManualScheduleItems(importedSessions, durationMinutes);
    const dates = scheduleItems.map((item) => item.date);
    const firstItem = scheduleItems[0];

    const nextScheduleJson: Record<string, unknown> = {
      ...currentSchedule,
      scheduleItems,
      dates,
      scheduleMode: scheduleItems.length > 1 ? "multiple" : "single",
      ...(firstItem
        ? {
            startTime: firstItem.startTime,
            ...(firstItem.endTime ? { endTime: firstItem.endTime } : {}),
          }
        : {}),
      manualScheduleOverride: true,
    };

    await tx.importFieldOverride.upsert({
      where: {
        entityType_entityId_fieldName: {
          entityType: "EVENT",
          entityId: activityId,
          fieldName: "scheduleJson",
        },
      },
      create: {
        entityType: "EVENT",
        entityId: activityId,
        fieldName: "scheduleJson",
        lockMode: "PREFER_MANUAL",
        reason: "Schedule switched to manual editing in event wizard",
        createdByUserId: user.id,
      },
      update: {
        lockMode: "PREFER_MANUAL",
        reason: "Schedule switched to manual editing in event wizard",
        createdByUserId: user.id,
      },
    });

    await tx.activity.update({
      where: { id: activityId },
      data: {
        scheduleJson: nextScheduleJson as Prisma.InputJsonValue,
      },
    });

    // Preserve startsAt and ticket metadata, but remove import identity. From
    // this point the ordinary wizard sync may replace source:null rows safely.
    await tx.activitySession.updateMany({
      where: { activityId, source: { not: null } },
      data: { source: null, externalId: null },
    });

    return { kind: "ok", scheduleItems };
  });

  if (takeover.kind === "not-found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (takeover.kind === "no-imported-sessions") {
    return NextResponse.json(
      { error: "Imported schedule is no longer active" },
      { status: 409 },
    );
  }
  if (takeover.kind === "duplicate-starts") {
    return NextResponse.json(
      {
        error:
          "В источнике есть несколько разных сеансов на одно и то же время. Ручное редактирование заблокировано, чтобы не потерять билетную ссылку одного из сеансов.",
        code: "DUPLICATE_IMPORTED_SESSION_START",
        duplicateStartsAt: takeover.duplicateStartsAt,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    scheduleItems: takeover.scheduleItems,
    manualOverride: true,
  });
}
