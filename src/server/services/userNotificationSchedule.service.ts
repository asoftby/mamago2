import { Prisma, Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  computeNextPlanEveningRunAt,
  DEFAULT_NOTIFICATION_TIME_ZONE,
  DEFAULT_PLAN_EVENING_TIME,
  DEFAULT_PLAN_REMINDER_OFFSET_MINUTES,
  isPlanReminderOffsetAllowed,
  isValidLocalTime,
  isValidTimeZone,
  normalizePlanReminderOffset,
  type NotificationTimeZoneMode,
} from "@/lib/notifications/userNotificationSchedule";

export class UserNotificationScheduleValidationError extends Error {
  constructor(
    public readonly code:
      | "INVALID_TIME_ZONE"
      | "INVALID_TIME_ZONE_MODE"
      | "INVALID_EVENING_TIME"
      | "INVALID_REMINDER_OFFSET",
    message: string,
  ) {
    super(message);
    this.name = "UserNotificationScheduleValidationError";
  }
}

export type UserPlanNotificationSchedule = {
  timeZone: string;
  timeZoneMode: NotificationTimeZoneMode;
  planEveningEnabled: boolean;
  planEveningTime: string;
  planEveningNextRunAt: Date;
  planReminderEnabled: boolean;
  planReminderOffsetMinutes: number;
};

export type UserReminderSchedule = {
  enabled: boolean;
  offsetMinutes: number;
  timeZone: string;
};

function defaultSchedule(now: Date): UserPlanNotificationSchedule {
  return {
    timeZone: DEFAULT_NOTIFICATION_TIME_ZONE,
    timeZoneMode: "AUTO",
    planEveningEnabled: true,
    planEveningTime: DEFAULT_PLAN_EVENING_TIME,
    planEveningNextRunAt: computeNextPlanEveningRunAt({
      now,
      timeZone: DEFAULT_NOTIFICATION_TIME_ZONE,
      localTime: DEFAULT_PLAN_EVENING_TIME,
    }),
    planReminderEnabled: true,
    planReminderOffsetMinutes: DEFAULT_PLAN_REMINDER_OFFSET_MINUTES,
  };
}

function normalizeRow(row: {
  timeZone: string;
  timeZoneMode: string;
  planEveningEnabled: boolean;
  planEveningTime: string;
  planEveningNextRunAt: Date;
  planReminderEnabled: boolean;
  planReminderOffsetMinutes: number;
}): UserPlanNotificationSchedule {
  return {
    ...row,
    timeZoneMode: row.timeZoneMode === "MANUAL" ? "MANUAL" : "AUTO",
  };
}

export async function ensureUserNotificationSchedule(
  userId: string,
  now: Date = new Date(),
): Promise<UserPlanNotificationSchedule> {
  const existing = await prisma.userNotificationSchedule.findUnique({
    where: { userId },
  });
  if (existing) return normalizeRow(existing);

  const defaults = defaultSchedule(now);
  try {
    const created = await prisma.userNotificationSchedule.create({
      data: { userId, ...defaults },
    });
    return normalizeRow(created);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const raced = await prisma.userNotificationSchedule.findUniqueOrThrow({
      where: { userId },
    });
    return normalizeRow(raced);
  }
}

export async function getUserNotificationSchedule(
  userId: string,
  now: Date = new Date(),
): Promise<UserPlanNotificationSchedule> {
  return ensureUserNotificationSchedule(userId, now);
}

export async function updateUserNotificationSchedule(args: {
  userId: string;
  role: Role;
  input: Partial<{
    timeZone: string;
    timeZoneMode: NotificationTimeZoneMode;
    planEveningEnabled: boolean;
    planEveningTime: string;
    planReminderEnabled: boolean;
    planReminderOffsetMinutes: number;
  }>;
  now?: Date;
}): Promise<UserPlanNotificationSchedule> {
  const now = args.now ?? new Date();
  const current = await ensureUserNotificationSchedule(args.userId, now);

  if (args.input.timeZone !== undefined && !isValidTimeZone(args.input.timeZone)) {
    throw new UserNotificationScheduleValidationError(
      "INVALID_TIME_ZONE",
      "Неизвестный часовой пояс",
    );
  }
  if (
    args.input.timeZoneMode !== undefined &&
    args.input.timeZoneMode !== "AUTO" &&
    args.input.timeZoneMode !== "MANUAL"
  ) {
    throw new UserNotificationScheduleValidationError(
      "INVALID_TIME_ZONE_MODE",
      "Некорректный режим часового пояса",
    );
  }
  if (
    args.input.planEveningTime !== undefined &&
    !isValidLocalTime(args.input.planEveningTime)
  ) {
    throw new UserNotificationScheduleValidationError(
      "INVALID_EVENING_TIME",
      "Некорректное время уведомления",
    );
  }
  if (
    args.input.planReminderOffsetMinutes !== undefined &&
    !isPlanReminderOffsetAllowed(
      args.input.planReminderOffsetMinutes,
      args.role === Role.ADMIN,
    )
  ) {
    throw new UserNotificationScheduleValidationError(
      "INVALID_REMINDER_OFFSET",
      args.role === Role.ADMIN
        ? "Допустимо 5, 30, 60, 120 или 180 минут"
        : "Допустимо 30, 60, 120 или 180 минут",
    );
  }

  const timeZone = args.input.timeZone ?? current.timeZone;
  const planEveningTime = args.input.planEveningTime ?? current.planEveningTime;
  const becameEnabled =
    args.input.planEveningEnabled === true && !current.planEveningEnabled;
  const timingChanged =
    args.input.timeZone !== undefined ||
    args.input.planEveningTime !== undefined ||
    becameEnabled;

  const nextRunAt = timingChanged
    ? computeNextPlanEveningRunAt({ now, timeZone, localTime: planEveningTime })
    : current.planEveningNextRunAt;

  const updated = await prisma.userNotificationSchedule.update({
    where: { userId: args.userId },
    data: {
      ...(args.input.timeZone !== undefined ? { timeZone } : {}),
      ...(args.input.timeZoneMode !== undefined
        ? { timeZoneMode: args.input.timeZoneMode }
        : {}),
      ...(args.input.planEveningEnabled !== undefined
        ? { planEveningEnabled: args.input.planEveningEnabled }
        : {}),
      ...(args.input.planEveningTime !== undefined ? { planEveningTime } : {}),
      ...(timingChanged ? { planEveningNextRunAt: nextRunAt } : {}),
      ...(args.input.planReminderEnabled !== undefined
        ? { planReminderEnabled: args.input.planReminderEnabled }
        : {}),
      ...(args.input.planReminderOffsetMinutes !== undefined
        ? { planReminderOffsetMinutes: args.input.planReminderOffsetMinutes }
        : {}),
    },
  });
  return normalizeRow(updated);
}

export async function getReminderSettingsForUsers(
  userIds: string[],
): Promise<Map<string, UserReminderSchedule>> {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: {
      id: true,
      role: true,
      notificationSchedule: {
        select: {
          timeZone: true,
          planReminderEnabled: true,
          planReminderOffsetMinutes: true,
        },
      },
    },
  });

  return new Map(
    users.map((user) => {
      const offsetMinutes = normalizePlanReminderOffset(
        user.notificationSchedule?.planReminderOffsetMinutes,
        user.role === Role.ADMIN,
      );

      return [
        user.id,
        {
          enabled: user.notificationSchedule?.planReminderEnabled ?? true,
          offsetMinutes,
          timeZone:
            user.notificationSchedule?.timeZone ?? DEFAULT_NOTIFICATION_TIME_ZONE,
        },
      ];
    }),
  );
}

export async function listDuePlanEveningSchedules(args: {
  now: Date;
  limit?: number;
}) {
  return prisma.userNotificationSchedule.findMany({
    where: {
      planEveningEnabled: true,
      planEveningNextRunAt: { lte: args.now },
    },
    orderBy: { planEveningNextRunAt: "asc" },
    take: args.limit ?? 250,
    select: {
      userId: true,
      timeZone: true,
      planEveningTime: true,
      planEveningNextRunAt: true,
    },
  });
}

export async function advancePlanEveningSchedule(
  userId: string,
  now: Date,
): Promise<void> {
  const current = await prisma.userNotificationSchedule.findUnique({
    where: { userId },
    select: { timeZone: true, planEveningTime: true },
  });
  if (!current) return;

  await prisma.userNotificationSchedule.update({
    where: { userId },
    data: {
      planEveningNextRunAt: computeNextPlanEveningRunAt({
        now,
        timeZone: current.timeZone,
        localTime: current.planEveningTime,
      }),
    },
  });
}
