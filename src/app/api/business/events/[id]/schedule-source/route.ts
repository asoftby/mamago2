import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";

export const runtime = "nodejs";

type ScheduleSourcePayload = {
  startAt?: string;
  endAt?: string;
  scheduleText?: string;
  occurrenceLines?: string[];
};

function extractScheduleSourcePayload(value: unknown): ScheduleSourcePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const occurrenceLines = Array.isArray(raw.occurrenceLines)
    ? raw.occurrenceLines.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  return {
    startAt: typeof raw.startAt === "string" ? raw.startAt : undefined,
    endAt: typeof raw.endAt === "string" ? raw.endAt : undefined,
    scheduleText:
      typeof raw.scheduleText === "string"
        ? raw.scheduleText
        : typeof raw.schedule === "string"
          ? raw.schedule
          : undefined,
    occurrenceLines,
  };
}

function cleanScheduleLine(line: string): string {
  return line.replace(/\s+/g, " ").replace(/\s*[-–]\s*/g, "–").trim();
}

function hasAllDayCue(input?: string) {
  const value = (input ?? "").toLowerCase();
  return value.includes("весь день") || value.includes("all day");
}

function formatScheduleRange(startAt: string, endAt?: string, scheduleText?: string): string | null {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return null;

  const end = endAt ? new Date(endAt) : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  const sameDay = validEnd
    ? start.getUTCFullYear() === validEnd.getUTCFullYear() &&
      start.getUTCMonth() === validEnd.getUTCMonth() &&
      start.getUTCDate() === validEnd.getUTCDate()
    : true;
  const allDay = hasAllDayCue(scheduleText);

  const dateFormatter = new Intl.DateTimeFormat("ru-BY", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Minsk",
  });
  const shortDateFormatter = new Intl.DateTimeFormat("ru-BY", {
    day: "numeric", month: "long", timeZone: "Europe/Minsk",
  });
  const timeFormatter = new Intl.DateTimeFormat("ru-BY", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Minsk",
  });

  if (!validEnd) {
    return allDay
      ? `${dateFormatter.format(start)}, весь день`
      : `${dateFormatter.format(start)}, ${timeFormatter.format(start)}`;
  }

  if (sameDay) {
    return allDay
      ? `${dateFormatter.format(start)}, весь день`
      : `${dateFormatter.format(start)}, ${timeFormatter.format(start)}–${timeFormatter.format(validEnd)}`;
  }

  const sameMonthAndYear =
    start.getUTCFullYear() === validEnd.getUTCFullYear() && start.getUTCMonth() === validEnd.getUTCMonth();
  const startLabel = sameMonthAndYear
    ? new Intl.DateTimeFormat("ru-BY", { day: "numeric", timeZone: "Europe/Minsk" }).format(start)
    : shortDateFormatter.format(start);
  const endLabel = dateFormatter.format(validEnd);

  return allDay
    ? `${startLabel}–${endLabel}`
    : `${startLabel}–${endLabel}, ${timeFormatter.format(start)}–${timeFormatter.format(validEnd)}`;
}

function buildScheduleItems(source: ScheduleSourcePayload): string[] {
  const items: string[] = [];
  if (source.startAt) {
    const formatted = formatScheduleRange(source.startAt, source.endAt, source.scheduleText);
    if (formatted) items.push(formatted);
  }
  if (source.occurrenceLines && source.occurrenceLines.length > 0) {
    items.push(...source.occurrenceLines.map(cleanScheduleLine));
  } else if (source.scheduleText) {
    items.push(...source.scheduleText.split("\n").map(cleanScheduleLine).filter(Boolean));
  }
  return items.filter((item, index, arr) => arr.indexOf(item) === index);
}

export async function GET(
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
    select: { id: true },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const linkedImport = await prisma.importedRecord.findFirst({
    where: { publishedActivityId: activityId },
    orderBy: { updatedAt: "desc" },
    select: { normalizedData: true, rawPayload: true },
  });

  const normalizedSource = extractScheduleSourcePayload(linkedImport?.normalizedData);
  const rawSource = extractScheduleSourcePayload(linkedImport?.rawPayload);
  const items = buildScheduleItems(normalizedSource);
  return NextResponse.json({ items: items.length > 0 ? items : buildScheduleItems(rawSource) });
}
