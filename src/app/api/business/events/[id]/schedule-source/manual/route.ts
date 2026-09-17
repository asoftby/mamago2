import { NextRequest, NextResponse } from "next/server";
import { ActivityType, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import prisma from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";

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
  // EventScheduleItem has no next-day time semantic. Keep the end blank rather
  // than inventing a misleading same-day range; durationMinutes remains in
  // scheduleJson and the editor can fill an explicit end when needed.
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

/**
 * POST /api/business/events/[id]/schedule-source/manual
 *
 * Explicitly hands an imported event's schedule over to the wizard/editor.
 * This is intentionally a separate action from ordinary PATCH saves:
 * unrelated edits must never destroy import-owned ActivitySession metadata.
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

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, type: ActivityType.EVENT },
    select: { id: true, scheduleJson: true },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const importedSessions = await prisma.activitySession.findMany({
    where: { activityId, source: { not: null } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true },
  });

  if (importedSessions.length === 0) {
    return NextResponse.json(
      { error: "Imported schedule is no longer active" },
      { status: 409 },
    );
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

  await prisma.$transaction([
    prisma.importFieldOverride.upsert({
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
    }),
    prisma.activity.update({
      where: { id: activityId },
      data: {
        scheduleJson: nextScheduleJson as Prisma.InputJsonValue,
      },
    }),
    // Preserve startsAt and ticket metadata, but remove import identity. From
    // this point the normal wizard sync may replace source:null rows safely.
    prisma.activitySession.updateMany({
      where: { activityId, source: { not: null } },
      data: { source: null, externalId: null },
    }),
  ]);

  return NextResponse.json({
    success: true,
    scheduleItems,
    manualOverride: true,
  });
}
