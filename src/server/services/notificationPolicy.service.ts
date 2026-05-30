import {
  NotificationPolicySurface,
  type NotificationPolicy,
  type NotificationScenario,
  type NotificationType,
  Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";

export type NotificationPolicySeed = {
  key: string;
  surface: NotificationPolicySurface;
  notificationType?: NotificationType | null;
  scenario?: NotificationScenario | null;
  enabled: boolean;
  allowedInApp: boolean;
  allowedEmail: boolean;
  allowedTelegram: boolean;
  defaultInApp: boolean;
  defaultEmail: boolean;
  defaultTelegram: boolean;
  minCooldownMinutes?: number | null;
  maxPerDay?: number | null;
  quietHoursEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  digestTime?: string | null;
  defaultReminderOffsetMinutes?: number | null;
  availableReminderOffsets: number[];
  isSystemLocked: boolean;
  description?: string | null;
};

export type NotificationPolicyUpdateInput = Partial<{
  enabled: boolean;
  allowedInApp: boolean;
  allowedEmail: boolean;
  allowedTelegram: boolean;
  defaultInApp: boolean;
  defaultEmail: boolean;
  defaultTelegram: boolean;
  minCooldownMinutes: number | null;
  maxPerDay: number | null;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  digestTime: string | null;
  defaultReminderOffsetMinutes: number | null;
  availableReminderOffsets: number[];
  description: string | null;
}>;

export const DEFAULT_NOTIFICATION_POLICIES: NotificationPolicySeed[] = [
  {
    key: "PLAN_EVENT_2H_BEFORE",
    surface: NotificationPolicySurface.USER,
    notificationType: "REMINDER",
    scenario: "PLAN_EVENT_2H_BEFORE",
    enabled: true,
    allowedInApp: true,
    allowedEmail: true,
    allowedTelegram: true,
    defaultInApp: true,
    defaultEmail: false,
    defaultTelegram: false,
    minCooldownMinutes: 90,
    maxPerDay: 6,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    digestTime: null,
    defaultReminderOffsetMinutes: 120,
    availableReminderOffsets: [30, 60, 120, 180],
    isSystemLocked: false,
    description: "Напоминание о событии в плане перед началом.",
  },
  {
    key: "PLAN_TOMORROW_DIGEST",
    surface: NotificationPolicySurface.USER,
    notificationType: "PLAN_TOMORROW_DIGEST",
    scenario: "PLAN_TOMORROW_DIGEST",
    enabled: true,
    allowedInApp: true,
    allowedEmail: true,
    allowedTelegram: true,
    defaultInApp: false,
    defaultEmail: true,
    defaultTelegram: false,
    minCooldownMinutes: 720,
    maxPerDay: 1,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    digestTime: "19:00",
    defaultReminderOffsetMinutes: null,
    availableReminderOffsets: [],
    isSystemLocked: false,
    description: "Сводка на завтра по событиям в плане пользователя.",
  },
  {
    key: "BOOKING_REQUESTS",
    surface: NotificationPolicySurface.BUSINESS,
    notificationType: "BOOKING_CREATED",
    scenario: null,
    enabled: true,
    allowedInApp: true,
    allowedEmail: true,
    allowedTelegram: true,
    defaultInApp: true,
    defaultEmail: true,
    defaultTelegram: false,
    minCooldownMinutes: 10,
    maxPerDay: 50,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestTime: null,
    defaultReminderOffsetMinutes: null,
    availableReminderOffsets: [],
    isSystemLocked: false,
    description: "Новые заявки и изменения по заявкам для бизнеса.",
  },
  {
    key: "ADMIN_MODERATION",
    surface: NotificationPolicySurface.ADMIN,
    notificationType: "ADMIN_MODERATION_ITEM_CREATED",
    scenario: null,
    enabled: true,
    allowedInApp: true,
    allowedEmail: true,
    allowedTelegram: true,
    defaultInApp: true,
    defaultEmail: false,
    defaultTelegram: false,
    minCooldownMinutes: 5,
    maxPerDay: 100,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestTime: null,
    defaultReminderOffsetMinutes: null,
    availableReminderOffsets: [],
    isSystemLocked: false,
    description: "Новые элементы на модерацию для администраторов и редакторов.",
  },
  {
    key: "BUSINESS_VERIFICATION",
    surface: NotificationPolicySurface.BUSINESS,
    notificationType: "BUSINESS_VERIFIED",
    scenario: null,
    enabled: true,
    allowedInApp: true,
    allowedEmail: true,
    allowedTelegram: true,
    defaultInApp: true,
    defaultEmail: true,
    defaultTelegram: false,
    minCooldownMinutes: 60,
    maxPerDay: 10,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestTime: null,
    defaultReminderOffsetMinutes: null,
    availableReminderOffsets: [],
    isSystemLocked: false,
    description: "Статусы верификации бизнеса и важные шаги по проверке.",
  },
  {
    key: "SYSTEM_NOTIFICATIONS",
    surface: NotificationPolicySurface.SYSTEM,
    notificationType: "SYSTEM",
    scenario: null,
    enabled: true,
    allowedInApp: true,
    allowedEmail: true,
    allowedTelegram: false,
    defaultInApp: true,
    defaultEmail: true,
    defaultTelegram: false,
    minCooldownMinutes: 30,
    maxPerDay: 20,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestTime: null,
    defaultReminderOffsetMinutes: null,
    availableReminderOffsets: [],
    isSystemLocked: true,
    description: "Системные уведомления, влияющие на безопасность и доступность продукта.",
  },
];

function normalizeTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeOffsets(offsets: number[] | null | undefined): number[] {
  return [...new Set((offsets ?? []).filter((value) => Number.isFinite(value) && value > 0))]
    .map((value) => Math.round(value))
    .sort((left, right) => left - right);
}

function policyOrderKey(policy: Pick<NotificationPolicy, "key">): number {
  const index = DEFAULT_NOTIFICATION_POLICIES.findIndex((item) => item.key === policy.key);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export async function listNotificationPolicies(): Promise<NotificationPolicy[]> {
  const policies = await prisma.notificationPolicy.findMany();
  return [...policies].sort((left, right) => {
    const orderDiff = policyOrderKey(left) - policyOrderKey(right);
    if (orderDiff !== 0) return orderDiff;
    return left.key.localeCompare(right.key);
  });
}

export async function getNotificationPolicyByKey(
  key: string,
): Promise<NotificationPolicy | null> {
  return prisma.notificationPolicy.findUnique({
    where: { key },
  });
}

export async function getEffectiveNotificationPolicyForScenario(
  scenario: NotificationScenario,
): Promise<NotificationPolicy | null> {
  const direct = await prisma.notificationPolicy.findFirst({
    where: { scenario },
  });

  if (direct) return direct;

  return getNotificationPolicyByKey(scenario);
}

export async function updateNotificationPolicy(args: {
  id: string;
  input: NotificationPolicyUpdateInput;
}): Promise<NotificationPolicy> {
  const nextData: Prisma.NotificationPolicyUpdateInput = {};

  if (typeof args.input.enabled === "boolean") nextData.enabled = args.input.enabled;
  if (typeof args.input.allowedInApp === "boolean") nextData.allowedInApp = args.input.allowedInApp;
  if (typeof args.input.allowedEmail === "boolean") nextData.allowedEmail = args.input.allowedEmail;
  if (typeof args.input.allowedTelegram === "boolean") nextData.allowedTelegram = args.input.allowedTelegram;
  if (typeof args.input.defaultInApp === "boolean") nextData.defaultInApp = args.input.defaultInApp;
  if (typeof args.input.defaultEmail === "boolean") nextData.defaultEmail = args.input.defaultEmail;
  if (typeof args.input.defaultTelegram === "boolean") nextData.defaultTelegram = args.input.defaultTelegram;
  if (Object.prototype.hasOwnProperty.call(args.input, "minCooldownMinutes")) {
    nextData.minCooldownMinutes = args.input.minCooldownMinutes ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(args.input, "maxPerDay")) {
    nextData.maxPerDay = args.input.maxPerDay ?? null;
  }
  if (typeof args.input.quietHoursEnabled === "boolean") {
    nextData.quietHoursEnabled = args.input.quietHoursEnabled;
  }
  if (Object.prototype.hasOwnProperty.call(args.input, "quietHoursStart")) {
    nextData.quietHoursStart = normalizeTime(args.input.quietHoursStart);
  }
  if (Object.prototype.hasOwnProperty.call(args.input, "quietHoursEnd")) {
    nextData.quietHoursEnd = normalizeTime(args.input.quietHoursEnd);
  }
  if (Object.prototype.hasOwnProperty.call(args.input, "digestTime")) {
    nextData.digestTime = normalizeTime(args.input.digestTime);
  }
  if (Object.prototype.hasOwnProperty.call(args.input, "defaultReminderOffsetMinutes")) {
    nextData.defaultReminderOffsetMinutes = args.input.defaultReminderOffsetMinutes ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(args.input, "availableReminderOffsets")) {
    nextData.availableReminderOffsets = normalizeOffsets(args.input.availableReminderOffsets);
  }
  if (Object.prototype.hasOwnProperty.call(args.input, "description")) {
    nextData.description = args.input.description?.trim() || null;
  }

  return prisma.notificationPolicy.update({
    where: { id: args.id },
    data: nextData,
  });
}

export async function seedDefaultNotificationPolicies(): Promise<NotificationPolicy[]> {
  for (const policy of DEFAULT_NOTIFICATION_POLICIES) {
    await prisma.notificationPolicy.upsert({
      where: { key: policy.key },
      create: {
        ...policy,
        quietHoursStart: normalizeTime(policy.quietHoursStart),
        quietHoursEnd: normalizeTime(policy.quietHoursEnd),
        digestTime: normalizeTime(policy.digestTime),
        availableReminderOffsets: normalizeOffsets(policy.availableReminderOffsets),
      },
      update: {
        surface: policy.surface,
        notificationType: policy.notificationType ?? null,
        scenario: policy.scenario ?? null,
        description: policy.description ?? null,
        isSystemLocked: policy.isSystemLocked,
      },
    });
  }

  return listNotificationPolicies();
}
