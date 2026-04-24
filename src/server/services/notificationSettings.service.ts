import { NotificationChannel, type NotificationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import {
  buildEmptyNotificationSettingsSurfaceData,
  getNotificationSettingsGroupDefinitions,
  getNotificationSettingsTypeDefinitions,
  getNotificationSurfaceDefaults,
  resolveNotificationSettingsSurfaceForType,
  isNotificationTypeSupportedOnSurface,
  type ChannelDefaults,
  type NotificationSettingsRow,
  type NotificationSettingsSurface,
  type NotificationSettingsSurfaceData,
} from "@/lib/notifications/settingsDomain";
import { normalizeLegacyUserNotificationType, LEGACY_USER_TYPE_TO_ACTIVE_TYPE } from "@/lib/notifications/userNotificationEvents";
import { wouldDisableLastSystemNotificationChannel } from "@/lib/notifications/userNotificationPresentation";
import {
  updatePreference,
  updatePreferenceChannel,
  type PreferenceRow,
  type UpdatePreferenceInput,
} from "./notificationPreference.service";

export class NotificationSettingsValidationError extends Error {
  code: "SYSTEM_CHANNEL_REQUIRED";

  constructor(code: "SYSTEM_CHANNEL_REQUIRED", message: string) {
    super(message);
    this.name = "NotificationSettingsValidationError";
    this.code = code;
  }
}

function toChannelRecord(defaults: ChannelDefaults): Record<NotificationChannel, boolean> {
  return {
    IN_APP: defaults.inApp,
    EMAIL: defaults.email,
    TELEGRAM: defaults.telegram,
  };
}

function toLegacyPreferenceRow(row: NotificationSettingsRow): PreferenceRow {
  return {
    notificationType: row.notificationType,
    inApp: row.channels.IN_APP,
    email: row.channels.EMAIL,
    telegram: row.channels.TELEGRAM,
    isOverridden: row.isOverridden,
  };
}

function assertSupportedNotificationType(
  surface: NotificationSettingsSurface,
  notificationType: NotificationType,
): void {
  if (!isNotificationTypeSupportedOnSurface(surface, notificationType)) {
    throw new Error(`Notification type ${notificationType} is not available on ${surface}`);
  }
}

export async function getNotificationSettingsSurfaceData(
  userId: string,
  surface: NotificationSettingsSurface,
): Promise<NotificationSettingsSurfaceData> {
  const definitions = getNotificationSettingsTypeDefinitions(surface);
  const notificationTypes = definitions.map((definition) => definition.type);

  if (notificationTypes.length === 0) {
    const empty = buildEmptyNotificationSettingsSurfaceData(surface);
    const telegramStatus = await getTelegramLinkStatus({ userId });

    return {
      ...empty,
      telegramConnected: telegramStatus.linked,
      telegramUsername: telegramStatus.username ?? undefined,
    };
  }

  const [storedPreferences, telegramStatus] = await Promise.all([
    prisma.userNotificationPreference.findMany({
      where: {
        userId,
        // For USER surface: also fetch legacy types so we can fold them in below.
        // For BUSINESS/ADMIN: only fetch the exact active types.
        notificationType: surface === "USER"
          ? { in: [...notificationTypes, ...Object.keys(LEGACY_USER_TYPE_TO_ACTIVE_TYPE) as NotificationType[]] }
          : { in: notificationTypes },
      },
      select: {
        notificationType: true,
        inAppEnabled: true,
        emailEnabled: true,
        telegramEnabled: true,
      },
    }),
    getTelegramLinkStatus({ userId }),
  ]);

  const overridesByType = new Map(
    // Only index active types directly — legacy rows are handled below
    storedPreferences
      .filter((row) => notificationTypes.includes(row.notificationType))
      .map((row) => [row.notificationType, row]),
  );

  // For USER surface: fold legacy preference rows into their active equivalents.
  // WELCOME → SYSTEM, ANNOUNCEMENT → NEWS.
  // Only applies when no active-type override already exists (active wins).
  if (surface === "USER") {
    for (const row of storedPreferences) {
      const normalized = normalizeLegacyUserNotificationType(row.notificationType);
      if (normalized !== row.notificationType && !overridesByType.has(normalized)) {
        overridesByType.set(normalized, row);
      }
    }
  }

  const rows = definitions.map((definition) => {
    const defaults = getNotificationSurfaceDefaults(surface, definition.type);
    const override = overridesByType.get(definition.type);

    return {
      notificationType: definition.type,
      label: definition.label,
      description: definition.description,
      audience: definition.audience,
      channels: {
        IN_APP: override?.inAppEnabled ?? defaults.inApp,
        EMAIL: override?.emailEnabled ?? defaults.email,
        TELEGRAM: override?.telegramEnabled ?? defaults.telegram,
      },
      defaultChannels: toChannelRecord(defaults),
      isOverridden: Boolean(override),
    } satisfies NotificationSettingsRow;
  });

  const rowsByType = new Map(rows.map((row) => [row.notificationType, row]));
  const groups = getNotificationSettingsGroupDefinitions(surface)
    .map((group) => ({
      ...group,
      rows: definitions.reduce<NotificationSettingsRow[]>((accumulator, definition) => {
        if (definition.groupId !== group.id) return accumulator;
        const row = rowsByType.get(definition.type);
        if (row) accumulator.push(row);
        return accumulator;
      }, []),
    }))
    .filter((group) => group.rows.length > 0);

  return {
    surface,
    telegramConnected: telegramStatus.linked,
    telegramUsername: telegramStatus.username ?? undefined,
    rows,
    groups,
  };
}

export async function getEffectiveNotificationChannelsForType(args: {
  userId: string;
  notificationType: NotificationType;
}): Promise<Record<NotificationChannel, boolean>> {
  const surface = resolveNotificationSettingsSurfaceForType(args.notificationType);
  const defaults = getNotificationSurfaceDefaults(surface, args.notificationType);

  const rows = await prisma.userNotificationPreference.findMany({
    where: surface === "USER"
      ? {
          userId: args.userId,
          notificationType: {
            in: [
              args.notificationType,
              ...Object.keys(LEGACY_USER_TYPE_TO_ACTIVE_TYPE) as NotificationType[],
            ],
          },
        }
      : {
          userId: args.userId,
          notificationType: args.notificationType,
        },
    select: {
      notificationType: true,
      inAppEnabled: true,
      emailEnabled: true,
      telegramEnabled: true,
    },
  });

  const direct = rows.find((row) => row.notificationType === args.notificationType);
  const fallbackLegacy = surface === "USER"
    ? rows.find((row) => normalizeLegacyUserNotificationType(row.notificationType) === args.notificationType)
    : undefined;
  const override = direct ?? fallbackLegacy;

  return {
    IN_APP: override?.inAppEnabled ?? defaults.inApp,
    EMAIL: override?.emailEnabled ?? defaults.email,
    TELEGRAM: override?.telegramEnabled ?? defaults.telegram,
  };
}

export async function isNotificationChannelEnabled(args: {
  userId: string;
  notificationType: NotificationType;
  channel: NotificationChannel;
}): Promise<boolean> {
  const channels = await getEffectiveNotificationChannelsForType({
    userId: args.userId,
    notificationType: args.notificationType,
  });

  return channels[args.channel];
}

export async function getLegacyNotificationPreferencesForSurface(
  userId: string,
  surface: NotificationSettingsSurface,
): Promise<PreferenceRow[]> {
  const data = await getNotificationSettingsSurfaceData(userId, surface);
  return data.rows.map(toLegacyPreferenceRow);
}

export async function updateNotificationSettingsValues(args: {
  userId: string;
  surface: NotificationSettingsSurface;
  notificationType: NotificationType;
  values: UpdatePreferenceInput;
}): Promise<void> {
  assertSupportedNotificationType(args.surface, args.notificationType);
  await updatePreference(args.userId, args.notificationType, args.values);
}

export async function updateNotificationSettingsChannelValue(args: {
  userId: string;
  surface: NotificationSettingsSurface;
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}): Promise<void> {
  assertSupportedNotificationType(args.surface, args.notificationType);

  const currentChannels = await getEffectiveNotificationChannelsForType({
    userId: args.userId,
    notificationType: args.notificationType,
  });

  if (
    wouldDisableLastSystemNotificationChannel({
      notificationType: args.notificationType,
      channels: currentChannels,
      channel: args.channel,
      enabled: args.enabled,
    })
  ) {
    throw new NotificationSettingsValidationError(
      "SYSTEM_CHANNEL_REQUIRED",
      "Системные уведомления должны быть включены хотя бы в одном канале",
    );
  }

  await updatePreferenceChannel(
    args.userId,
    args.notificationType,
    args.channel,
    args.enabled,
  );
}
