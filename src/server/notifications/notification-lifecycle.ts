import "server-only";

import type { Notification } from "@prisma/client";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import prisma from "@/lib/prisma";

export type ActionRequiredOnboardingKind =
  | "VERIFY_EMAIL"
  | "CONNECT_TELEGRAM"
  | "VERIFY_PHONE";

export type UserActionResolutionState = {
  emailVerified: boolean;
  telegramLinked: boolean;
  phoneVerified: boolean;
};

export type NotificationLifecycleFields = Pick<
  Notification,
  "type" | "entityId" | "metadata"
>;

export type NotificationLifecycleMeta = {
  actionRequired: boolean;
  actionResolved: boolean;
  canArchive: boolean;
};

const ACTION_REQUIRED_ENTITY_IDS = new Set<string>([
  "VERIFY_EMAIL",
  "CONNECT_TELEGRAM",
  "VERIFY_PHONE",
]);

export class NotificationArchiveBlockedError extends Error {
  readonly code = "ACTION_REQUIRED_UNRESOLVED" as const;

  constructor(message = "Нельзя архивировать уведомление, пока действие не выполнено") {
    super(message);
    this.name = "NotificationArchiveBlockedError";
  }
}

function readMetadataKind(metadata: Notification["metadata"]): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const kind = (metadata as Record<string, unknown>).kind;
  return typeof kind === "string" ? kind : null;
}

export function getActionRequiredKind(
  notification: NotificationLifecycleFields,
): ActionRequiredOnboardingKind | null {
  if (notification.type !== "SYSTEM") return null;

  const candidates = [notification.entityId, readMetadataKind(notification.metadata)];
  for (const candidate of candidates) {
    if (candidate && ACTION_REQUIRED_ENTITY_IDS.has(candidate)) {
      return candidate as ActionRequiredOnboardingKind;
    }
  }

  return null;
}

export function isActionRequiredNotification(
  notification: NotificationLifecycleFields,
): boolean {
  return getActionRequiredKind(notification) != null;
}

export function isActionRequiredNotificationResolved(
  notification: NotificationLifecycleFields,
  state: UserActionResolutionState,
): boolean {
  const kind = getActionRequiredKind(notification);
  if (!kind) return true;

  switch (kind) {
    case "VERIFY_EMAIL":
      return state.emailVerified;
    case "CONNECT_TELEGRAM":
      return state.telegramLinked;
    case "VERIFY_PHONE":
      return state.phoneVerified;
    default:
      return true;
  }
}

export function canArchiveNotification(
  notification: NotificationLifecycleFields,
  state: UserActionResolutionState,
): boolean {
  if (!isActionRequiredNotification(notification)) {
    return true;
  }
  return isActionRequiredNotificationResolved(notification, state);
}

export function getNotificationLifecycleMeta(
  notification: NotificationLifecycleFields,
  state: UserActionResolutionState,
): NotificationLifecycleMeta {
  const actionRequired = isActionRequiredNotification(notification);
  const actionResolved = isActionRequiredNotificationResolved(notification, state);
  return {
    actionRequired,
    actionResolved,
    canArchive: canArchiveNotification(notification, state),
  };
}

export async function getUserActionResolutionState(
  userId: string,
): Promise<UserActionResolutionState> {
  const [user, telegramStatus] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, phoneVerifiedAt: true },
    }),
    getTelegramLinkStatus({ userId }),
  ]);

  return {
    emailVerified: user?.emailVerifiedAt != null,
    telegramLinked: telegramStatus.linked,
    phoneVerified: user?.phoneVerifiedAt != null,
  };
}

export function enrichNotificationsWithLifecycle<
  T extends NotificationLifecycleFields,
>(
  notifications: T[],
  state: UserActionResolutionState,
): Array<T & NotificationLifecycleMeta> {
  return notifications.map((notification) => ({
    ...notification,
    ...getNotificationLifecycleMeta(notification, state),
  }));
}
