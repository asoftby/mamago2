import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSettingsContext } from "@/lib/settings/resolveSettingsContext";
import {
  getUserNotificationSchedule,
  updateUserNotificationSchedule,
  UserNotificationScheduleValidationError,
} from "@/server/services/userNotificationSchedule.service";

const patchSchema = z
  .object({
    timeZone: z.string().min(1).max(64).optional(),
    timeZoneMode: z.enum(["AUTO", "MANUAL"]).optional(),
    planEveningEnabled: z.boolean().optional(),
    planEveningTime: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    planReminderEnabled: z.boolean().optional(),
    planReminderOffsetMinutes: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Empty patch",
  });

export async function GET() {
  const context = await resolveSettingsContext({ requestedScope: "USER" });
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedule = await getUserNotificationSchedule(context.viewer.id);
  return NextResponse.json({
    ...schedule,
    planEveningNextRunAt: schedule.planEveningNextRunAt.toISOString(),
    canUseFiveMinuteReminder: context.viewer.role === "ADMIN",
  });
}

export async function PATCH(req: NextRequest) {
  const context = await resolveSettingsContext({ requestedScope: "USER" });
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const schedule = await updateUserNotificationSchedule({
      userId: context.viewer.id,
      role: context.viewer.role,
      input: parsed.data,
    });
    return NextResponse.json({
      ...schedule,
      planEveningNextRunAt: schedule.planEveningNextRunAt.toISOString(),
      canUseFiveMinuteReminder: context.viewer.role === "ADMIN",
    });
  } catch (error) {
    if (error instanceof UserNotificationScheduleValidationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 },
      );
    }
    throw error;
  }
}
