import type {
  NotificationChannelPreferenceMatrix,
  NotificationDeliveryOutcome,
  PreparedNotificationPayload,
  SendNotificationResult,
  SendNotificationInput,
} from "@/lib/notifications/domainContracts";

export function resolveExternalChannelChoiceCore(params: {
  preferences: NotificationChannelPreferenceMatrix;
  telegramConnected: boolean;
}): "BOTH" | "TELEGRAM" | "EMAIL" | null {
  const telegramEnabled = params.preferences.TELEGRAM && params.telegramConnected;
  const emailEnabled = params.preferences.EMAIL;

  if (telegramEnabled && emailEnabled) return "BOTH";
  if (telegramEnabled) return "TELEGRAM";
  if (emailEnabled) return "EMAIL";
  return null;
}

export type SendNotificationCoreDeps = {
  prepareNotificationFn: (input: SendNotificationInput) => Promise<PreparedNotificationPayload>;
  getChannelPreferencesFn: (
    input: SendNotificationInput,
  ) => Promise<NotificationChannelPreferenceMatrix>;
  sendInAppNotificationFn: (
    prepared: PreparedNotificationPayload,
  ) => Promise<{
    notificationId: string;
    deliveryId: string;
    outcome: NotificationDeliveryOutcome;
  }>;
  skipInAppNotificationFn: (
    prepared: PreparedNotificationPayload,
  ) => Promise<NotificationDeliveryOutcome>;
  findUserFn: (userId: string) => Promise<{ id: string; email: string | null } | null>;
  getTelegramConnectionFn: (
    userId: string,
  ) => Promise<{ isActive?: boolean; telegramChatId?: string } | null>;
  sendTelegramNotificationFn: (params: {
    userId: string;
    notificationId: string | null;
    telegramChatId: string;
    prepared: PreparedNotificationPayload;
  }) => Promise<NotificationDeliveryOutcome>;
  skipTelegramNotificationFn: (params: {
    userId: string;
    notificationId?: string | null;
    prepared: PreparedNotificationPayload;
    reason: "USER_DISABLED_CHANNEL" | "CHANNEL_NOT_CONNECTED";
  }) => Promise<NotificationDeliveryOutcome>;
  sendEmailNotificationFn: (params: {
    userId: string;
    notificationId: string | null;
    email: string | null | undefined;
    prepared: PreparedNotificationPayload;
  }) => Promise<NotificationDeliveryOutcome>;
  skipEmailNotificationFn: (params: {
    userId: string;
    notificationId?: string | null;
    prepared: PreparedNotificationPayload;
    reason: "USER_DISABLED_CHANNEL";
  }) => Promise<NotificationDeliveryOutcome>;
};

export async function sendNotificationCore(
  input: SendNotificationInput,
  deps: SendNotificationCoreDeps,
): Promise<SendNotificationResult> {
  const prepared = await deps.prepareNotificationFn(input);

  if (!prepared.shouldSend) {
    return {
      status: "SKIPPED",
      notificationId: null,
      prepared,
      deliveries: [],
      reason: prepared.skipReason ?? "DUPLICATE_ALREADY_SENT",
    };
  }

  const preferences = await deps.getChannelPreferencesFn(input);
  const user = await deps.findUserFn(input.userId);
  const telegramConnection = await deps.getTelegramConnectionFn(input.userId);
  const telegramConnected =
    telegramConnection?.isActive === true && Boolean(telegramConnection.telegramChatId);

  const deliveries: NotificationDeliveryOutcome[] = [];
  let notificationId: string | null = null;

  if (preferences.IN_APP) {
    const inAppDelivery = await deps.sendInAppNotificationFn(prepared);
    notificationId = inAppDelivery.notificationId;
    deliveries.push(inAppDelivery.outcome);
  } else {
    deliveries.push(await deps.skipInAppNotificationFn(prepared));
  }

  if (!preferences.TELEGRAM) {
    deliveries.push(
      await deps.skipTelegramNotificationFn({
        userId: input.userId,
        notificationId,
        prepared,
        reason: "USER_DISABLED_CHANNEL",
      }),
    );
  } else if (telegramConnected && telegramConnection?.telegramChatId) {
    deliveries.push(
      await deps.sendTelegramNotificationFn({
        userId: input.userId,
        notificationId,
        telegramChatId: telegramConnection.telegramChatId,
        prepared,
      }),
    );
  } else {
    deliveries.push(
      await deps.skipTelegramNotificationFn({
        userId: input.userId,
        notificationId,
        prepared,
        reason: "CHANNEL_NOT_CONNECTED",
      }),
    );
  }

  const externalChannel = resolveExternalChannelChoiceCore({
    preferences,
    telegramConnected,
  });

  if (externalChannel === "EMAIL" || externalChannel === "BOTH") {
    deliveries.push(
      await deps.sendEmailNotificationFn({
        userId: input.userId,
        notificationId,
        email: user?.email,
        prepared,
      }),
    );
  } else if (!preferences.EMAIL) {
    deliveries.push(
      await deps.skipEmailNotificationFn({
        userId: input.userId,
        notificationId,
        prepared,
        reason: "USER_DISABLED_CHANNEL",
      }),
    );
  }

  return {
    status: "SENT",
    notificationId,
    prepared,
    deliveries,
  };
}
