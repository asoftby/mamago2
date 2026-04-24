import type {
  NotificationChannel as PrismaNotificationChannel,
  NotificationDeliveryStatus as PrismaNotificationStatus,
  NotificationScenario as PrismaNotificationScenario,
} from "@prisma/client";

export type NotificationScenario = PrismaNotificationScenario;

export const NOTIFICATION_SCENARIOS = {
  PLAN_EVENT_2H_BEFORE: "PLAN_EVENT_2H_BEFORE",
} as const satisfies Record<string, NotificationScenario>;

/**
 * Product-level channel contract for the next notification phase.
 * DASHBOARD and TG are explicit domain aliases; delivery wiring comes later.
 */
export type NotificationChannel =
  | "IN_APP"
  | "DASHBOARD"
  | "TG"
  | "EMAIL";

export type PersistedNotificationChannel = PrismaNotificationChannel;

export type NotificationStatus = Extract<
  PrismaNotificationStatus,
  "SENT" | "FAILED" | "SKIPPED"
>;

export type NotificationChannelPreferenceMatrix = {
  IN_APP: boolean;
  EMAIL: boolean;
  TELEGRAM: boolean;
};

export type SendNotificationContext = {
  /**
   * The reminder should be anchored to the user's saved plan row,
   * not to a generic activity schedule.
   */
  planItemId: string;
  activityId?: string | null;
  eventTitle: string;
  startsAt: Date;
  placeName?: string | null;
  cityName?: string | null;
};

export type SendNotificationInput = {
  scenario: NotificationScenario;
  userId: string;
  context: SendNotificationContext;
};

export type RenderedNotificationContent = {
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type NotificationSkipReason =
  | "DUPLICATE_ALREADY_SENT"
  | "NO_ENABLED_CHANNELS";

export type NotificationDeliverySuppressedReason =
  | "USER_DISABLED_CHANNEL"
  | "CHANNEL_NOT_CONNECTED"
  | "EMAIL_NOT_CONFIGURED";

export type PreparedNotificationPayload = {
  scenario: NotificationScenario;
  userId: string;
  dedupeKey: string;
  content: RenderedNotificationContent;
  context: SendNotificationContext;
  shouldSend: boolean;
  skipReason: NotificationSkipReason | null;
};

export type NotificationDeliveryLogSeed = {
  scenario: NotificationScenario;
  channel: PersistedNotificationChannel;
  status?: PrismaNotificationStatus;
  dedupeKey?: string | null;
  payloadJson?: Record<string, unknown> | null;
};

export type NotificationDeliveryOutcome = {
  channel: PersistedNotificationChannel;
  status: NotificationStatus;
  deliveryId: string | null;
  errorMessage?: string | null;
};

export type SendNotificationResult =
  | {
      status: "SENT";
      notificationId: string | null;
      prepared: PreparedNotificationPayload;
      deliveries: NotificationDeliveryOutcome[];
    }
  | {
      status: "SKIPPED";
      notificationId: null;
      prepared: PreparedNotificationPayload;
      deliveries: NotificationDeliveryOutcome[];
      reason: NotificationSkipReason;
    };
